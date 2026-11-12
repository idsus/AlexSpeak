import { EnergyScorer, type EnergyScore, type VoiceProfile } from './energy.ts'
import type { Veto } from './speaker.ts'

export const SAMPLE_RATE = 16000
export const FRAME_SIZE = 512 // Silero's frame at 16 kHz (32 ms)

type Detector = 'vad' | 'energy'
export interface Attempt {
  kind: 'attempt'
  t: number // seconds of audio pushed, not wall-clock, so replays are bit-identical
  channel: Detector
  parentScore?: number
}
/** A voice the veto recognised as an enrolled adult: logged, never rewarded. */
export interface ParentHeard {
  kind: 'parent'
  t: number
  channel: Detector
  parentScore: number
}
export type Outcome = Attempt | ParentHeard
/** One voiced stretch that fired or was vetoed, for closeness, the "what the mic heard" list and clips. */
export interface Segment {
  t0: number
  t1: number
  samples: Float32Array
  outcome: Outcome
}

export interface EngineOptions {
  sensitivity: number
  noiseRejection: number
  voiceProfile?: VoiceProfile
  veto?: Veto | null
  onSegment?: (s: Segment) => void
}

const FRAME_S = FRAME_SIZE / SAMPLE_RATE
const ATTEMPT_COOLDOWN_S = 0.65
const LISTEN_CALIBRATION_S = 0.42
const SUSTAINED_VOICE_S = 0.07
// Low on purpose: Silero is trained on speech, and hums, squeals and soft "ah" are its weak spot.
const VAD_THRESHOLD = 0.3
// The camera saw the mouth move: a hint that tips a borderline sound over, never an attempt alone.
const VAD_BOOST_THRESHOLD = 0.2
// Two frames (~64 ms) so a single click or bang can't fire on its own.
const VAD_MIN_FRAMES = 2
// Enough voice for a stable speaker embedding; shorter segments are judged when they end.
const VETO_VOICED_S = 0.4
const PREROLL_FRAMES = 3
const HANGOVER_FRAMES = 10 // ~320 ms of quiet ends a segment
// A short sound is judged sooner than the segment closes, so the reward isn't held back by the hangover.
const VETO_QUIET_FRAMES = 5
const MAX_SEGMENT_S = 5
// After the trial closes the child may still be finishing the word; keep it, but not the app's reply.
const AFTER_PAUSE_S = 0.6

interface Open {
  frames: Float32Array[]
  t0: number
  voiced: number
  quiet: number
  pausedAt: number | null
  candidate: { t: number; channel: Detector } | null
  outcome: Promise<Outcome> | Outcome | null
}

let warnedVeto = false

/**
 * Turns a 16 kHz mono stream into attempts. Pure and DOM-free so the browser
 * channel and the replay harness run the exact same code. Silero's speech
 * probability is computed by the caller (it's async) and passed in per frame;
 * without it the engine runs on the energy detector alone.
 *
 * Without a veto an attempt is returned synchronously, exactly as in Phase A. With an
 * enrolled adult, push returns a promise at the moment enough voice is buffered.
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
  private vadThreshold = VAD_THRESHOLD
  private veto: Veto | null
  private preroll: Float32Array[] = []
  private seg: Open | null = null
  private readonly energy: EnergyScorer

  constructor(private readonly opts: EngineOptions) {
    this.energy = new EnergyScorer({ voiceProfile: 'wide', ...opts }, SAMPLE_RATE, FRAME_SIZE)
    this.veto = opts.veto ?? null
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

  setVeto(veto: Veto | null): void {
    this.veto = veto
  }

  setBoost(on: boolean): void {
    this.vadThreshold = on ? VAD_BOOST_THRESHOLD : VAD_THRESHOLD
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
    if (!this.seg) return
    // An unjudged candidate is dropped: the wait is over, so it can no longer be rewarded.
    if (this.seg.candidate) this.seg.candidate = null
    if (this.seg.outcome) this.seg.pausedAt ??= this.t
    else this.seg = null
  }

  push(frame: Float32Array, vadProb?: number): Outcome | Promise<Outcome> | null {
    if (frame.length !== FRAME_SIZE) throw new Error(`expected ${FRAME_SIZE} samples, got ${frame.length}`)
    this.samples += FRAME_SIZE
    const now = this.t
    const calibrating = this.listening && !this.calibratedOnce && now - this.listenStartedAt < LISTEN_CALIBRATION_S
    if (this.listening && !calibrating) this.calibratedOnce = true

    const s = this.energy.score(frame, this.listening, calibrating)
    this.lastScore = s
    const vadVoiced = vadProb !== undefined && vadProb >= this.vadThreshold
    this.vadRun = vadVoiced ? this.vadRun + 1 : 0
    if (!s.accepted || calibrating) this.aboveThresholdSince = null
    const judged = this.track(frame, s.accepted || vadVoiced, now)
    if (judged) return judged
    if (!this.listening || now < this.cooldownUntil || this.seg?.candidate) return null

    let channel: Detector | null = null
    if (this.vadRun >= VAD_MIN_FRAMES) channel = 'vad'
    else if (s.accepted && !calibrating) {
      this.aboveThresholdSince ??= now
      if (now - this.aboveThresholdSince >= SUSTAINED_VOICE_S) channel = 'energy'
    }
    if (!channel) return null
    this.aboveThresholdSince = null
    this.vadRun = 0
    this.cooldownUntil = now + ATTEMPT_COOLDOWN_S
    if (!this.veto || !this.seg) {
      const hit: Attempt = { kind: 'attempt', t: now, channel }
      if (this.seg) this.seg.outcome = hit
      return hit
    }
    this.seg.candidate = { t: now, channel }
    return this.judgeIfReady(false)
  }

  /** Segment bookkeeping; returns a veto decision when this frame completes one. */
  private track(frame: Float32Array, voiced: boolean, now: number): Promise<Outcome> | null {
    let seg = this.seg
    if (!seg) {
      if (voiced && this.listening) {
        this.seg = seg = { frames: [...this.preroll], t0: now - (this.preroll.length + 1) * FRAME_S, voiced: 0, quiet: 0, pausedAt: null, candidate: null, outcome: null }
        this.preroll = []
      } else {
        this.preroll.push(frame)
        if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift()
        return null
      }
    }
    seg.frames.push(frame)
    if (voiced) {
      seg.voiced += 1
      seg.quiet = 0
    } else seg.quiet += 1
    const ended =
      seg.quiet >= HANGOVER_FRAMES || now - seg.t0 >= MAX_SEGMENT_S || (seg.pausedAt !== null && now - seg.pausedAt >= AFTER_PAUSE_S)
    const judged = seg.candidate ? this.judgeIfReady(ended || seg.quiet >= VETO_QUIET_FRAMES) : null
    if (ended) this.close(seg, now)
    return judged
  }

  private judgeIfReady(ended: boolean): Promise<Outcome> | null {
    const seg = this.seg
    if (!seg?.candidate || !this.veto) return null
    if (!ended && seg.voiced * FRAME_S < VETO_VOICED_S) return null
    // The reward fires when the check settles, so latency is measured from here, not the candidate.
    const { t } = this
    const { channel } = seg.candidate
    seg.candidate = null
    const veto = this.veto
    const decided = veto(concat(seg.frames)).then(
      (r): Outcome => (r.parent ? { kind: 'parent', t, channel, parentScore: r.score } : { kind: 'attempt', t, channel, parentScore: r.score }),
      (err): Outcome => {
        if (!warnedVeto) console.warn('Speaker check failed; rewarding every voice as before.', err)
        warnedVeto = true
        if (this.veto === veto) this.veto = null
        return { kind: 'attempt', t, channel }
      },
    )
    seg.outcome = decided
    return decided
  }

  private close(seg: Open, now: number): void {
    this.seg = null
    if (!seg.outcome || !this.opts.onSegment) return
    const keep = seg.frames.slice(0, seg.frames.length - Math.min(seg.quiet, seg.frames.length - 1))
    const samples = concat(keep)
    const t1 = now - (seg.frames.length - keep.length) * FRAME_S
    void Promise.resolve(seg.outcome).then((outcome) => this.opts.onSegment?.({ t0: seg.t0, t1, samples, outcome }))
  }
}

function concat(frames: Float32Array[]): Float32Array {
  const out = new Float32Array(frames.length * FRAME_SIZE)
  frames.forEach((f, i) => out.set(f, i * FRAME_SIZE))
  return out
}
