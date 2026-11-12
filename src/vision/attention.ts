// Pure signal logic for the camera channel: no DOM, no MediaPipe. Unit-tested in attention.test.ts.

export interface AttentionSample {
  /** Milliseconds, monotonic. */
  t: number
  face: boolean
  /** Degrees, 0 = facing the screen. */
  yaw: number
  pitch: number
  /** 0..1, MediaPipe's jawOpen blendshape. */
  jawOpen: number
}

export interface AttentionSignals {
  looking: boolean
  mouthMoved: boolean
  mouthOpen: number
}

const MAX_YAW = 25
const MAX_PITCH = 20
const HOLD_MS = 300 // raw "looking" must hold this long before the output flips (both ways)
const MOUTH_WINDOW_MS = 600
const MOUTH_RANGE = 0.12
const SMOOTH = 0.5 // EMA weight of the newest jawOpen at ~10 fps

export class AttentionTracker {
  private looking = false
  private flipSince: number | null = null
  private mouth: { t: number; v: number }[] = []
  private mouthOpen = 0

  /** Forget history, e.g. after a pause. */
  reset(): void {
    this.looking = false
    this.flipSince = null
    this.mouth = []
    this.mouthOpen = 0
  }

  push(s: AttentionSample): AttentionSignals {
    const raw = s.face && Math.abs(s.yaw) < MAX_YAW && Math.abs(s.pitch) < MAX_PITCH
    if (raw === this.looking) this.flipSince = null
    else if (this.flipSince === null) this.flipSince = s.t
    if (this.flipSince !== null && s.t - this.flipSince >= HOLD_MS) {
      this.looking = raw
      this.flipSince = null
    }

    if (s.face) {
      this.mouth.push({ t: s.t, v: s.jawOpen })
      while (this.mouth[0].t < s.t - MOUTH_WINDOW_MS) this.mouth.shift()
      this.mouthOpen += SMOOTH * (s.jawOpen - this.mouthOpen)
    } else {
      this.mouth = []
      this.mouthOpen = 0
    }
    let lo = Infinity
    let hi = -Infinity
    for (const m of this.mouth) {
      lo = Math.min(lo, m.v)
      hi = Math.max(hi, m.v)
    }
    const mouthMoved = this.mouth.length > 1 && hi - lo > MOUTH_RANGE

    return { looking: this.looking, mouthMoved, mouthOpen: Math.max(0, Math.min(1, this.mouthOpen)) }
  }
}

const DEG = 180 / Math.PI

/** Yaw/pitch in degrees from MediaPipe's 4×4 facial transformation matrix (column-major). */
export function poseFromMatrix(m: ArrayLike<number>): { yaw: number; pitch: number } {
  const r = (row: number, col: number) => m[col * 4 + row]
  return {
    yaw: Math.asin(Math.max(-1, Math.min(1, -r(2, 0)))) * DEG,
    pitch: Math.atan2(r(2, 1), r(2, 2)) * DEG,
  }
}
