import { EnergyScorer, type EnergyScore, type VoiceProfile } from './energy.ts'

export const SAMPLE_RATE = 16000
export const FRAME_SIZE = 512 // Silero's frame at 16 kHz (32 ms)

export interface Attempt {
  t: number // seconds of audio pushed, not wall-clock, so replays are bit-identical
  channel: 'vad' | 'energy'
}

export interface EngineOptions {
  sensitivity: number
  noiseRejection: number
  voiceProfile?: VoiceProfile
}

const ATTEMPT_COOLDOWN_S = 0.65
const LISTEN_CALIBRATION_S = 0.42
const SUSTAINED_VOICE_S = 0.07
// Low on purpose: Silero is trained on speech, and hums, squeals and soft "ah" are its weak spot.
const VAD_THRESHOLD = 0.3
// Two frames (~64 ms) so a single click or bang can't fire on its own.
const VAD_MIN_FRAMES = 2

/**
 * Turns a 16 kHz mono stream into attempts. Pure and DOM-free so the browser
 * channel and the replay harness run the exact same code. Silero's speech
 * probability is computed by the caller (it's async) and passed in per frame;
 * without it the engine runs on the energy detector alone.
 */
export class AttemptEngine {
  listening = false
  lastScore: EnergyScore = { score: 0, volume: 0, voiceMatch: 0, noise: 0, accepted: false }
  private samples = 0
  private cooldownUntil = 0
  private listenStartedAt = 0
  // Calibrate the room ONCE per session. Without this, every coach re-cue
  // resumes the mic and re-triggers a deaf window — exactly when he is most
  // likely to answer — so real attempts were being thrown away.
  private calibratedOnce = false
  private aboveThresholdSince: number | null = null
  private vadRun = 0
  private readonly energy: EnergyScorer

  constructor(opts: EngineOptions) {
    this.energy = new EnergyScorer({ voiceProfile: 'wide', ...opts }, SAMPLE_RATE, FRAME_SIZE)
  }

  /** Seconds of audio consumed so far. */
  get t(): number {
    return this.samples / SAMPLE_RATE
  }

  setSensitivity(n: number): void {
    this.energy.threshold = n
  }

  setNoiseRejection(n: number): void {
    this.energy.noiseRejection = n
  }

  resume(): void {
    this.listening = true
    if (!this.calibratedOnce) this.listenStartedAt = this.t
    this.aboveThresholdSince = null
    this.vadRun = 0
  }

  pause(): void {
    this.listening = false
    this.aboveThresholdSince = null
    this.vadRun = 0
  }

  push(frame: Float32Array, vadProb?: number): Attempt | null {
    if (frame.length !== FRAME_SIZE) throw new Error(`expected ${FRAME_SIZE} samples, got ${frame.length}`)
    this.samples += FRAME_SIZE
    const now = this.t
    const calibrating = this.listening && !this.calibratedOnce && now - this.listenStartedAt < LISTEN_CALIBRATION_S
    if (this.listening && !calibrating) this.calibratedOnce = true

    const s = this.energy.score(frame, this.listening, calibrating)
    this.lastScore = s
    this.vadRun = vadProb !== undefined && vadProb >= VAD_THRESHOLD ? this.vadRun + 1 : 0
    if (!s.accepted || calibrating) this.aboveThresholdSince = null
    if (!this.listening || now < this.cooldownUntil) return null

    let channel: Attempt['channel'] | null = null
    if (this.vadRun >= VAD_MIN_FRAMES) channel = 'vad'
    else if (s.accepted && !calibrating) {
      this.aboveThresholdSince ??= now
      if (now - this.aboveThresholdSince >= SUSTAINED_VOICE_S) channel = 'energy'
    }
    if (!channel) return null
    this.aboveThresholdSince = null
    this.vadRun = 0
    this.cooldownUntil = now + ATTEMPT_COOLDOWN_S
    return { t: now, channel }
  }
}
