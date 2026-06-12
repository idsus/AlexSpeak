import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// Silent-mouthing detector. MediaPipe Face Landmarker outputs 52 blendshape
// scores per frame; `jawOpen` is a clean normalized 0..1 mouth-open signal.
// Two consecutive frames above threshold = an attempt, so silent mouth
// movements count exactly like sounds.

export interface MouthChannelOptions {
  /** jawOpen score threshold, 0..1 — lower = more sensitive */
  sensitivity: number
  onAttempt: () => void
}

const CONSECUTIVE_FRAMES_NEEDED = 2

export class MouthChannel {
  private running = false
  private rafId = 0
  private framesAboveThreshold = 0
  private sensitivity: number

  private constructor(
    private landmarker: FaceLandmarker,
    private video: HTMLVideoElement,
    private onAttempt: () => void,
    sensitivity: number,
  ) {
    this.sensitivity = sensitivity
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
    return new MouthChannel(landmarker, video, options.onAttempt, options.sensitivity)
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = sensitivity
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.framesAboveThreshold = 0
    const tick = () => {
      if (!this.running) return
      if (this.video.readyState >= 2) {
        const result = this.landmarker.detectForVideo(this.video, performance.now())
        const blendshapes = result.faceBlendshapes?.[0]?.categories
        const jawOpen = blendshapes?.find((c) => c.categoryName === 'jawOpen')?.score ?? 0
        if (jawOpen > this.sensitivity) {
          this.framesAboveThreshold += 1
          if (this.framesAboveThreshold >= CONSECUTIVE_FRAMES_NEEDED) {
            this.framesAboveThreshold = 0
            this.onAttempt()
          }
        } else {
          this.framesAboveThreshold = 0
        }
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  destroy(): void {
    this.stop()
    this.landmarker.close()
  }
}
