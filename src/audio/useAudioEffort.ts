import { getMicStream } from './useMic'
import type { Settings } from '../data/settings'

export interface AudioEffortScore {
  score: number
  volume: number
  voiceMatch: number
  noise: number
  threshold: number
  noiseRejection: number
  listening: boolean
  calibrating: boolean
  volumeGate: number
  voiceGate: number
  passesNoiseGate: boolean
  reason: string
}

export interface AudioEffortChannelOptions {
  /** Effort score threshold, 0..100. Lower = more sensitive. */
  sensitivity: number
  noiseRejection: number
  voiceProfile: Settings['audioVoiceProfile']
  onAttempt: () => void
  onScore?: (score: AudioEffortScore) => void
}

const ATTEMPT_COOLDOWN_MS = 650
const LISTEN_CALIBRATION_MS = 420
const SUSTAINED_VOICE_MS = 70
const MIN_VOLUME_GATE = 10
// A clearly loud, sustained sound counts as an attempt even if it is not very
// "voice-like" spectrally — an atypical or hoarse vocalization is still real
// communicative effort, and missing it is the harmful error. We still require a
// little voice-likeness so a pure broadband bang/fan does not constantly fire.
const STRONG_SOUND_VOLUME = 40
// Volume clearly above the room (but lower than STRONG_SOUND_VOLUME) at which a
// voice-band sound is accepted on loudness alone — catches quiet/moderate
// vocalizations the effort threshold used to drop.
const AUDIBLE_SOUND_VOLUME = 24
const STRONG_SOUND_VOICE_FLOOR = 26
const EPSILON = 0.000001

const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)))

const VOICE_PROFILES: Record<Settings['audioVoiceProfile'], { label: string; minHz: number; maxHz: number }> = {
  higher: { label: 'higher', minHz: 180, maxHz: 950 },
  middle: { label: 'middle', minHz: 120, maxHz: 720 },
  lower: { label: 'lower', minHz: 80, maxHz: 520 },
  wide: { label: 'wide', minHz: 80, maxHz: 1100 },
}

function zeroCrossingRate(samples: Float32Array<ArrayBuffer>): number {
  let crossings = 0
  for (let i = 1; i < samples.length; i += 1) {
    if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) {
      crossings += 1
    }
  }
  return crossings / samples.length
}

function rms(samples: Float32Array<ArrayBuffer>): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

// Continuous, on-device vocal-effort detector. This is intentionally broader
// than speech recognition: quiet repeated sounds like "ah ah ah" should score.
export class AudioEffortChannel {
  private running = true
  private listening = false
  private rafId = 0
  private cooldownUntil = 0
  private listenStartedAt = 0
  // Calibrate the room ONCE per session. Without this, every coach re-cue
  // resumes the mic and re-triggers a ~520ms deaf window — exactly when he is
  // most likely to answer — so real attempts were being thrown away.
  private calibratedOnce = false
  private aboveThresholdSince: number | null = null
  private lastScoreEmitAt = 0
  private noiseFloor = 0.01
  private readonly samples: Float32Array<ArrayBuffer>
  private readonly rawFrequency: Uint8Array<ArrayBuffer>
  private readonly profile: { label: string; minHz: number; maxHz: number }

  private constructor(
    private readonly stream: MediaStream,
    private readonly audioContext: AudioContext,
    private readonly audioSource: MediaStreamAudioSourceNode,
    private readonly rawAnalyser: AnalyserNode,
    private readonly voiceAnalyser: AnalyserNode,
    private readonly highPass: BiquadFilterNode,
    private readonly lowPass: BiquadFilterNode,
    private threshold: number,
    private noiseRejection: number,
    voiceProfile: Settings['audioVoiceProfile'],
    private readonly onAttempt: () => void,
    private readonly onScore?: (score: AudioEffortScore) => void,
  ) {
    this.profile = VOICE_PROFILES[voiceProfile]
    this.samples = new Float32Array(
      new ArrayBuffer(voiceAnalyser.fftSize * Float32Array.BYTES_PER_ELEMENT),
    )
    this.rawFrequency = new Uint8Array(new ArrayBuffer(rawAnalyser.frequencyBinCount))
    this.tick()
  }

  static async create(options: AudioEffortChannelOptions): Promise<AudioEffortChannel> {
    const stream = await getMicStream()
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    const audioContext = new AudioContextCtor()
    const profile = VOICE_PROFILES[options.voiceProfile]
    const source = audioContext.createMediaStreamSource(stream)
    const rawAnalyser = audioContext.createAnalyser()
    const highPass = audioContext.createBiquadFilter()
    const lowPass = audioContext.createBiquadFilter()
    const voiceAnalyser = audioContext.createAnalyser()

    rawAnalyser.fftSize = 2048
    rawAnalyser.smoothingTimeConstant = 0.15
    voiceAnalyser.fftSize = 2048
    voiceAnalyser.smoothingTimeConstant = 0.18
    highPass.type = 'highpass'
    highPass.frequency.value = Math.max(55, profile.minHz * 0.72)
    highPass.Q.value = 0.85
    lowPass.type = 'lowpass'
    lowPass.frequency.value = Math.min(audioContext.sampleRate / 2 - 100, profile.maxHz * 1.18)
    lowPass.Q.value = 0.75

    source.connect(rawAnalyser)
    source.connect(highPass)
    highPass.connect(lowPass)
    lowPass.connect(voiceAnalyser)

    return new AudioEffortChannel(
      stream,
      audioContext,
      source,
      rawAnalyser,
      voiceAnalyser,
      highPass,
      lowPass,
      options.sensitivity,
      options.noiseRejection,
      options.voiceProfile,
      options.onAttempt,
      options.onScore,
    )
  }

  setSensitivity(_sensitivity: number): void {
    this.threshold = _sensitivity
  }

  setNoiseRejection(noiseRejection: number): void {
    this.noiseRejection = noiseRejection
  }

  /** Resume listening (call when a listen window opens). */
  async resume(): Promise<void> {
    this.listening = true
    // Only the very first resume of a session calibrates; later resumes (after
    // each coach cue) start listening immediately so nothing is missed.
    if (!this.calibratedOnce) this.listenStartedAt = performance.now()
    this.aboveThresholdSince = null
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()
  }

  /** Pause attempt firing while the app itself is speaking. */
  async pause(): Promise<void> {
    this.listening = false
    this.aboveThresholdSince = null
  }

  async destroy(): Promise<void> {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.lowPass.disconnect()
    this.highPass.disconnect()
    this.rawAnalyser.disconnect()
    this.voiceAnalyser.disconnect()
    this.audioSource.disconnect()
    this.stream.getTracks().forEach((track) => track.stop())
    await this.audioContext.close().catch(() => {})
  }

  private tick = () => {
    if (!this.running) return

    const now = performance.now()
    this.voiceAnalyser.getFloatTimeDomainData(this.samples)
    this.rawAnalyser.getByteFrequencyData(this.rawFrequency)
    const bandEnergy = rms(this.samples)
    const zcr = zeroCrossingRate(this.samples)
    const spectral = this.analyzeSpectrum()
    const calibrating =
      this.listening && !this.calibratedOnce && now - this.listenStartedAt < LISTEN_CALIBRATION_MS
    if (this.listening && !this.calibratedOnce && now - this.listenStartedAt >= LISTEN_CALIBRATION_MS) {
      this.calibratedOnce = true
    }

    if (!this.listening || (!calibrating && spectral.voiceMatch < this.noiseRejection - 10)) {
      const boundedEnergy = Math.min(Math.max(bandEnergy, 0.003), this.noiseFloor * 2.6)
      this.noiseFloor = this.noiseFloor * 0.992 + boundedEnergy * 0.008
    }

    const energyOverRoom = Math.max(0, bandEnergy - this.noiseFloor * 1.45)
    const volume = clampPercent((energyOverRoom / Math.max(this.noiseFloor * 5.5, 0.018)) * 100)
    const zcrMatch = this.zcrMatch(zcr)
    const voiceMatch = clampPercent(spectral.voiceMatch * 0.74 + zcrMatch * 0.26 - spectral.noise * 0.32)
    const rawScore = clampPercent(volume * 0.52 + voiceMatch * 0.48)
    const passesNoiseGate = voiceMatch >= this.noiseRejection && volume >= MIN_VOLUME_GATE
    // A loud, clearly-sustained sound is accepted even when it just misses the
    // spectral gate — it is still real effort. Pure noise (very low voiceMatch)
    // is still rejected.
    const clearLoudSound =
      volume >= STRONG_SOUND_VOLUME &&
      voiceMatch >= Math.max(STRONG_SOUND_VOICE_FLOOR, this.noiseRejection - 18)
    // Volume-led path: any clearly-audible voice-band sound counts, even if the
    // overall effort score sits below the threshold. Loudness above the room is
    // the most reliable "he made a sound" signal, and missing it is the harm we
    // most want to avoid. The cooldown keeps it from over-firing.
    const audibleVoiceSound =
      volume >= AUDIBLE_SOUND_VOLUME &&
      voiceMatch >= Math.max(STRONG_SOUND_VOICE_FLOOR, this.noiseRejection - 22)
    const meetsEffort = rawScore >= this.threshold
    const accepted = (meetsEffort && (passesNoiseGate || clearLoudSound)) || audibleVoiceSound
    const score = passesNoiseGate || clearLoudSound || audibleVoiceSound
      ? rawScore
      : Math.min(rawScore, Math.max(0, this.threshold - 1))
    const reason = !this.listening
      ? 'paused'
      : calibrating
        ? 'calibrating room'
        : accepted
          ? clearLoudSound || audibleVoiceSound
            ? 'clear sound accepted'
            : 'voice accepted'
          : volume < MIN_VOLUME_GATE
            ? 'voice too quiet'
            : voiceMatch < this.noiseRejection
              ? 'not voice-like enough'
              : 'below effort threshold'

    if (now - this.lastScoreEmitAt >= 90) {
      this.lastScoreEmitAt = now
      this.onScore?.({
        score,
        volume,
        voiceMatch,
        noise: spectral.noise,
        threshold: this.threshold,
        noiseRejection: this.noiseRejection,
        listening: this.listening,
        calibrating,
        volumeGate: MIN_VOLUME_GATE,
        voiceGate: this.noiseRejection,
        passesNoiseGate,
        reason,
      })
    }

    if (this.listening && !calibrating && now >= this.cooldownUntil && accepted) {
      this.aboveThresholdSince ??= now
      if (now - this.aboveThresholdSince >= SUSTAINED_VOICE_MS) {
        this.aboveThresholdSince = null
        this.cooldownUntil = now + ATTEMPT_COOLDOWN_MS
        this.onAttempt()
      }
    } else if (!accepted || calibrating) {
      this.aboveThresholdSince = null
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private analyzeSpectrum(): { voiceMatch: number; noise: number } {
    const binHz = this.audioContext.sampleRate / this.rawAnalyser.fftSize
    let totalEnergy = 0
    let voiceEnergy = 0
    let noiseEnergy = 0
    let voicePeak = 0
    let voiceBins = 0

    for (let i = 1; i < this.rawFrequency.length; i += 1) {
      const hz = i * binHz
      const amplitude = this.rawFrequency[i] / 255
      const energy = amplitude * amplitude
      totalEnergy += energy

      if (hz >= this.profile.minHz && hz <= this.profile.maxHz) {
        voiceEnergy += energy
        voicePeak = Math.max(voicePeak, energy)
        voiceBins += 1
      } else if (hz < this.profile.minHz * 0.62 || hz > this.profile.maxHz * 1.35) {
        noiseEnergy += energy
      }
    }

    const dominance = clampPercent((voiceEnergy / Math.max(totalEnergy, EPSILON)) * 120)
    const averageVoiceEnergy = voiceEnergy / Math.max(voiceBins, 1)
    const peakiness = voicePeak / Math.max(averageVoiceEnergy, EPSILON)
    const peakScore = clampPercent((peakiness - 1.4) * 18)
    const noise = clampPercent((noiseEnergy / Math.max(voiceEnergy + noiseEnergy, EPSILON)) * 110)

    return {
      voiceMatch: clampPercent(dominance * 0.62 + peakScore * 0.38),
      noise,
    }
  }

  private zcrMatch(zcr: number): number {
    const min = (this.profile.minHz * 2) / this.audioContext.sampleRate
    const max = (this.profile.maxHz * 2) / this.audioContext.sampleRate
    if (zcr >= min && zcr <= max) return 100

    const distance = zcr < min ? min - zcr : zcr - max
    const tolerance = Math.max(max - min, 0.015)
    return clampPercent(100 - (distance / tolerance) * 100)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
