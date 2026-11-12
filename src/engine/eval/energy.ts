// The energy/voice-band detector that used to live in useAudioEffort.ts, ported
// from AnalyserNode/BiquadFilterNode to plain math so it runs on 16 kHz frames
// identically in the browser and in the Node replay harness.

export type VoiceProfile = 'higher' | 'middle' | 'lower' | 'wide'

export interface EnergyScore {
  score: number
  volume: number
  voiceMatch: number
  noise: number
  accepted: boolean
}

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
// AnalyserNode's defaults, so the spectrum bytes match what the browser gave us before.
const MIN_DB = -100
const MAX_DB = -30
const RAW_SMOOTHING = 0.15

const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)))

export const VOICE_PROFILES: Record<VoiceProfile, { minHz: number; maxHz: number }> = {
  higher: { minHz: 180, maxHz: 950 },
  middle: { minHz: 120, maxHz: 720 },
  lower: { minHz: 80, maxHz: 520 },
  wide: { minHz: 80, maxHz: 1100 },
}

/** Web Audio's lowpass/highpass biquad (Q in dB, as the spec defines it), direct form I. */
class Biquad {
  private b0: number
  private b1: number
  private b2: number
  private a1: number
  private a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(type: 'lowpass' | 'highpass', hz: number, qDb: number, sampleRate: number) {
    const w0 = (2 * Math.PI * hz) / sampleRate
    const cos = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * 10 ** (qDb / 20))
    const a0 = 1 + alpha
    const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos] : [(1 + cos) / 2, -(1 + cos)]
    this.b0 = b[0] / a0
    this.b1 = b[1] / a0
    this.b2 = b[0] / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  process(input: Float32Array, out: Float32Array): void {
    for (let i = 0; i < input.length; i += 1) {
      const x = input[i]
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
      this.x2 = this.x1
      this.x1 = x
      this.y2 = this.y1
      this.y1 = y
      out[i] = y
    }
  }
}

/** In-place radix-2 FFT; n must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k += 1) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const ar = re[i + k + len / 2]
        const ai = im[i + k + len / 2]
        const tr = ar * wr - ai * wi
        const ti = ar * wi + ai * wr
        re[i + k + len / 2] = re[i + k] - tr
        im[i + k + len / 2] = im[i + k] - ti
        re[i + k] += tr
        im[i + k] += ti
      }
    }
  }
}

function rms(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

function zeroCrossingRate(samples: Float32Array): number {
  let crossings = 0
  for (let i = 1; i < samples.length; i += 1) {
    if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) crossings += 1
  }
  return crossings / samples.length
}

/**
 * Continuous vocal-effort scorer, intentionally broader than speech
 * recognition: quiet repeated sounds like "ah ah ah" should score.
 */
export class EnergyScorer {
  threshold: number
  noiseRejection: number
  // Per-frame EMA (32 ms frames); the old rAF loop ran ~2x as often, so the
  // floor now adapts about half as fast. Retune on real clips if that matters.
  private noiseFloor = 0.01
  private readonly profile: { minHz: number; maxHz: number }
  private readonly highPass: Biquad
  private readonly lowPass: Biquad
  private readonly band: Float32Array
  private readonly window: Float64Array
  private readonly smoothed: Float64Array
  private readonly re: Float64Array
  private readonly im: Float64Array

  constructor(
    opts: { sensitivity: number; noiseRejection: number; voiceProfile: VoiceProfile },
    private readonly sampleRate: number,
    private readonly frameSize: number,
  ) {
    this.threshold = opts.sensitivity
    this.noiseRejection = opts.noiseRejection
    this.profile = VOICE_PROFILES[opts.voiceProfile]
    this.highPass = new Biquad('highpass', Math.max(55, this.profile.minHz * 0.72), 0.85, sampleRate)
    this.lowPass = new Biquad('lowpass', Math.min(sampleRate / 2 - 100, this.profile.maxHz * 1.18), 0.75, sampleRate)
    this.band = new Float32Array(frameSize)
    this.window = Float64Array.from({ length: frameSize }, (_, n) => {
      const x = (2 * Math.PI * n) / frameSize
      return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x)
    })
    this.smoothed = new Float64Array(frameSize / 2)
    this.re = new Float64Array(frameSize)
    this.im = new Float64Array(frameSize)
  }

  score(frame: Float32Array, listening: boolean, calibrating: boolean): EnergyScore {
    this.highPass.process(frame, this.band)
    this.lowPass.process(this.band, this.band)
    const bandEnergy = rms(this.band)
    const zcr = zeroCrossingRate(this.band)
    const spectral = this.analyzeSpectrum(frame)

    if (!listening || (!calibrating && spectral.voiceMatch < this.noiseRejection - 10)) {
      const boundedEnergy = Math.min(Math.max(bandEnergy, 0.003), this.noiseFloor * 2.6)
      this.noiseFloor = this.noiseFloor * 0.992 + boundedEnergy * 0.008
    }

    const energyOverRoom = Math.max(0, bandEnergy - this.noiseFloor * 1.45)
    const volume = clampPercent((energyOverRoom / Math.max(this.noiseFloor * 5.5, 0.018)) * 100)
    const voiceMatch = clampPercent(spectral.voiceMatch * 0.74 + this.zcrMatch(zcr) * 0.26 - spectral.noise * 0.32)
    const rawScore = clampPercent(volume * 0.52 + voiceMatch * 0.48)
    const passesNoiseGate = voiceMatch >= this.noiseRejection && volume >= MIN_VOLUME_GATE
    // A loud, clearly-sustained sound is accepted even when it just misses the
    // spectral gate — it is still real effort. Pure noise (very low voiceMatch)
    // is still rejected.
    const clearLoudSound =
      volume >= STRONG_SOUND_VOLUME && voiceMatch >= Math.max(STRONG_SOUND_VOICE_FLOOR, this.noiseRejection - 18)
    // Volume-led path: any clearly-audible voice-band sound counts, even if the
    // overall effort score sits below the threshold. Loudness above the room is
    // the most reliable "he made a sound" signal, and missing it is the harm we
    // most want to avoid. The cooldown keeps it from over-firing.
    const audibleVoiceSound =
      volume >= AUDIBLE_SOUND_VOLUME && voiceMatch >= Math.max(STRONG_SOUND_VOICE_FLOOR, this.noiseRejection - 22)
    const accepted = (rawScore >= this.threshold && (passesNoiseGate || clearLoudSound)) || audibleVoiceSound
    const score =
      passesNoiseGate || clearLoudSound || audibleVoiceSound ? rawScore : Math.min(rawScore, Math.max(0, this.threshold - 1))
    return { score, volume, voiceMatch, noise: spectral.noise, accepted }
  }

  /** Byte spectrum exactly as AnalyserNode.getByteFrequencyData builds it, then the old voice-band stats. */
  private analyzeSpectrum(frame: Float32Array): { voiceMatch: number; noise: number } {
    const n = this.frameSize
    for (let i = 0; i < n; i += 1) {
      this.re[i] = frame[i] * this.window[i]
      this.im[i] = 0
    }
    fft(this.re, this.im)
    const binHz = this.sampleRate / n
    let totalEnergy = 0
    let voiceEnergy = 0
    let noiseEnergy = 0
    let voicePeak = 0
    let voiceBins = 0

    for (let i = 0; i < n / 2; i += 1) {
      const mag = Math.hypot(this.re[i], this.im[i]) / n
      this.smoothed[i] = RAW_SMOOTHING * this.smoothed[i] + (1 - RAW_SMOOTHING) * mag
      if (i === 0) continue
      const db = 20 * Math.log10(Math.max(this.smoothed[i], 1e-12))
      const amplitude = Math.floor(Math.max(0, Math.min(255, (255 * (db - MIN_DB)) / (MAX_DB - MIN_DB)))) / 255
      const hz = i * binHz
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
    return { voiceMatch: clampPercent(dominance * 0.62 + peakScore * 0.38), noise }
  }

  private zcrMatch(zcr: number): number {
    const min = (this.profile.minHz * 2) / this.sampleRate
    const max = (this.profile.maxHz * 2) / this.sampleRate
    if (zcr >= min && zcr <= max) return 100
    const distance = zcr < min ? min - zcr : zcr - max
    const tolerance = Math.max(max - min, 0.015)
    return clampPercent(100 - (distance / tolerance) * 100)
  }
}
