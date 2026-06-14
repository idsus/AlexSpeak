import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export interface VisionScore {
  mouth: number
  attention: number
  faceSteady: number
  facePresent: boolean
  ready: boolean
  mouthThreshold: number
  attentionThreshold: number
  faceBox?: DebugBox
  mouthBox?: DebugBox
}

export interface MouthChannelOptions {
  /** Mouth score threshold, 0..100. Lower = more sensitive. */
  sensitivity: number
  attentionThreshold: number
  onAttempt: () => void
  onScore?: (score: VisionScore) => void
}

const ATTEMPT_COOLDOWN_MS = 900
const ATTENTION_STABLE_MS = 220
const MOUTH_HOLD_MS = 110

const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)))
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

type Landmark = { x: number; y: number; z?: number }

export interface DebugBox {
  x: number
  y: number
  width: number
  height: number
}

interface FaceMetrics {
  attention: number
  faceSteady: number
  facePresent: boolean
  faceBox?: DebugBox
  mouthBox?: DebugBox
}

export class MouthChannel {
  private running = false
  private attemptEnabled = false
  private rafId = 0
  private cooldownUntil = 0
  private lastScoreEmitAt = 0
  private attentionStableSince: number | null = null
  private mouthAboveSince: number | null = null
  private mouthBelowSince: number | null = null
  private mouthArmed = false
  private mouthBaseline = 0.04
  private lastCenter: { x: number; y: number; size: number } | null = null
  private sensitivity: number
  private attentionThreshold: number

  private constructor(
    private landmarker: FaceLandmarker,
    private video: HTMLVideoElement,
    private onAttempt: () => void,
    sensitivity: number,
    attentionThreshold: number,
    private onScore?: (score: VisionScore) => void,
  ) {
    this.sensitivity = sensitivity
    this.attentionThreshold = attentionThreshold
  }

  static async create(
    video: HTMLVideoElement,
    options: MouthChannelOptions,
  ): Promise<MouthChannel> {
    const fileset = await FilesetResolver.forVisionTasks('/models/mediapipe/wasm')
    const createWith = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/mediapipe/face_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
    // Older tablets (and headless test browsers) lack the WebGL support the
    // GPU delegate needs — fall back to CPU rather than losing the channel.
    const landmarker = await createWith('GPU').catch(() => createWith('CPU'))
    return new MouthChannel(
      landmarker,
      video,
      options.onAttempt,
      options.sensitivity,
      options.attentionThreshold,
      options.onScore,
    )
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = sensitivity
  }

  setAttentionThreshold(threshold: number): void {
    this.attentionThreshold = threshold
  }

  setAttemptEnabled(enabled: boolean): void {
    this.attemptEnabled = enabled
    this.rearm()
  }

  /**
   * Reset the arming state (so a mouth already held open does not instantly
   * fire against a freshly-lowered threshold) WITHOUT changing whether the
   * channel is enabled. Used when shaping criteria change mid-listen.
   */
  rearm(): void {
    this.mouthAboveSince = null
    this.mouthBelowSince = null
    this.mouthArmed = false
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    this.attemptEnabled = false
    cancelAnimationFrame(this.rafId)
  }

  destroy(): void {
    this.stop()
    this.landmarker.close()
  }

  private tick = () => {
    if (!this.running) return

    const now = performance.now()

    if (this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, now)
      const blendshapes = result.faceBlendshapes?.[0]?.categories
      const landmarks = result.faceLandmarks?.[0]
      const jawOpen = blendshapes?.find((c) => c.categoryName === 'jawOpen')?.score ?? 0
      const metrics = this.faceMetrics(landmarks)
      const mouth = this.mouthMovementScore(jawOpen, metrics.attention)
      const ready =
        metrics.facePresent &&
        metrics.attention >= this.attentionThreshold &&
        metrics.faceSteady >= 55 &&
        this.attentionStableSince !== null &&
        now - this.attentionStableSince >= ATTENTION_STABLE_MS

      if (now - this.lastScoreEmitAt >= 90) {
        this.lastScoreEmitAt = now
        this.onScore?.({
          mouth,
          attention: metrics.attention,
          faceSteady: metrics.faceSteady,
          facePresent: metrics.facePresent,
          ready,
          mouthThreshold: this.sensitivity,
          attentionThreshold: this.attentionThreshold,
          faceBox: metrics.faceBox,
          mouthBox: metrics.mouthBox,
        })
      }

      this.updateAttentionState(metrics, now)
      this.updateMouthArming(mouth, ready, now)

      if (this.shouldFireMouthAttempt(mouth, ready, now)) {
        this.mouthAboveSince ??= now
        if (now - this.mouthAboveSince >= MOUTH_HOLD_MS) {
          this.mouthAboveSince = null
          this.mouthBelowSince = null
          this.mouthArmed = false
          this.cooldownUntil = now + ATTEMPT_COOLDOWN_MS
          this.onAttempt()
        }
      } else {
        this.mouthAboveSince = null
      }
    } else if (now - this.lastScoreEmitAt >= 250) {
      this.lastScoreEmitAt = now
      this.onScore?.({
        mouth: 0,
        attention: 0,
        faceSteady: 0,
        facePresent: false,
        ready: false,
        mouthThreshold: this.sensitivity,
        attentionThreshold: this.attentionThreshold,
      })
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private mouthMovementScore(jawOpen: number, attention: number): number {
    const openEnoughToBeResting = jawOpen < this.mouthBaseline + 0.025
    if (!this.attemptEnabled || openEnoughToBeResting || attention < this.attentionThreshold) {
      this.mouthBaseline = this.mouthBaseline * 0.965 + clamp01(jawOpen) * 0.035
    }

    const movementFromBaseline = Math.max(0, jawOpen - this.mouthBaseline - 0.018)
    return clampPercent(movementFromBaseline * 420)
  }

  private faceMetrics(landmarks: Landmark[] | undefined): FaceMetrics {
    if (!landmarks?.length) {
      this.lastCenter = null
      this.attentionStableSince = null
      return { attention: 0, faceSteady: 0, facePresent: false }
    }

    let minX = 1
    let maxX = 0
    let minY = 1
    let maxY = 0
    for (const point of landmarks) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
    const width = maxX - minX
    const height = maxY - minY
    const centerX = minX + width / 2
    const centerY = minY + height / 2
    const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.48)
    const size = Math.min(width / 0.34, height / 0.42)
    const currentCenter = { x: centerX, y: centerY, size }
    const previousCenter = this.lastCenter
    this.lastCenter = currentCenter

    const leftEye = landmarks[33]
    const rightEye = landmarks[263]
    const nose = landmarks[1]
    const leftMouth = landmarks[61]
    const rightMouth = landmarks[291]
    const upperLip = landmarks[13]
    const lowerLip = landmarks[14]

    const centered = clampPercent(100 - centerDistance * 230)
    const sizeScore = clampPercent(size * 100)
    const notTooClose = clampPercent((1 - Math.max(0, width - 0.72) / 0.2) * 100)
    const roll = leftEye && rightEye ? Math.abs(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)) : 0
    const rollScore = clampPercent(100 - (roll * 180) / Math.PI * 4.2)

    const eyeMidX = leftEye && rightEye ? (leftEye.x + rightEye.x) / 2 : centerX
    const eyeDistance = leftEye && rightEye ? Math.max(0.001, Math.abs(rightEye.x - leftEye.x)) : width
    const yaw = nose ? Math.abs(nose.x - eyeMidX) / eyeDistance : 0
    const yawScore = clampPercent(100 - yaw * 165)

    const mouthWidth =
      leftMouth && rightMouth ? Math.abs(rightMouth.x - leftMouth.x) / Math.max(width, 0.001) : 0.42
    const frontalMouth = clampPercent(100 - Math.abs(mouthWidth - 0.42) * 230)

    const faceMotion = previousCenter
      ? Math.hypot(centerX - previousCenter.x, centerY - previousCenter.y) * 800 +
        Math.abs(size - previousCenter.size) * 180
      : 0
    const faceSteady = clampPercent(100 - faceMotion)

    const attention = clampPercent(
      centered * 0.27 +
        sizeScore * 0.18 +
        notTooClose * 0.12 +
        rollScore * 0.16 +
        yawScore * 0.16 +
        frontalMouth * 0.06 +
        faceSteady * 0.05,
    )

    const faceBox = {
      x: minX,
      y: minY,
      width,
      height,
    }
    const mouthPoints = [leftMouth, rightMouth, upperLip, lowerLip].filter(
      (point): point is Landmark => Boolean(point),
    )
    const mouthBox = this.boxForPoints(mouthPoints, 0.025)

    return { attention, faceSteady, facePresent: true, faceBox, mouthBox }
  }

  private boxForPoints(points: Landmark[], padding: number): DebugBox | undefined {
    if (!points.length) return undefined
    let minX = 1
    let maxX = 0
    let minY = 1
    let maxY = 0
    for (const point of points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(1, maxX + padding) - Math.max(0, minX - padding),
      height: Math.min(1, maxY + padding) - Math.max(0, minY - padding),
    }
  }

  private updateAttentionState(metrics: FaceMetrics, now: number): void {
    if (metrics.attention >= this.attentionThreshold && metrics.faceSteady >= 55) {
      this.attentionStableSince ??= now
    } else {
      this.attentionStableSince = null
      this.mouthArmed = false
    }
  }

  private updateMouthArming(mouth: number, ready: boolean, now: number): void {
    if (!this.attemptEnabled || !ready || now < this.cooldownUntil) return

    if (mouth <= this.sensitivity * 0.45) {
      this.mouthBelowSince ??= now
      if (now - this.mouthBelowSince >= 160) this.mouthArmed = true
    } else {
      this.mouthBelowSince = null
    }
  }

  private shouldFireMouthAttempt(mouth: number, ready: boolean, now: number): boolean {
    return (
      this.attemptEnabled &&
      this.mouthArmed &&
      ready &&
      now >= this.cooldownUntil &&
      mouth >= this.sensitivity
    )
  }
}
