import { useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { AttentionTracker, poseFromMatrix, type AttentionSignals } from './attention'

export type CameraState = 'off' | 'loading' | 'on' | 'denied' | 'unavailable'

export interface AttentionApi {
  state: CameraState
  /** A face is present and roughly facing the screen (smoothed, ~300 ms hysteresis). */
  looking: boolean
  /** Jaw-open changed meaningfully in the last ~600 ms. A hint only, never an attempt. */
  mouthMoved: boolean
  /** 0..1 smoothed jawOpen, for a meter. */
  mouthOpen: number
}

const MODEL_DIR = `${import.meta.env.BASE_URL}models/vision/`
const FRAME_MS = 100 // ≤ 10 fps
const IDLE: AttentionSignals = { looking: false, mouthMoved: false, mouthOpen: 0 }

let landmarker: Promise<FaceLandmarker> | null = null
let warned = false

function warnOnce(msg: string, err: unknown): void {
  if (!warned) console.warn(msg, err)
  warned = true
}

// Loaded only when the parent turns the camera on; cached for the rest of the session.
function loadLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= import('@mediapipe/tasks-vision')
    .then(({ FaceLandmarker }) =>
      FaceLandmarker.createFromOptions(
        // Only the SIMD build is shipped; every tablet browser this app targets has wasm SIMD.
        { wasmLoaderPath: `${MODEL_DIR}vision_wasm_internal.js`, wasmBinaryPath: `${MODEL_DIR}vision_wasm_internal.wasm` },
        {
          baseOptions: { modelAssetPath: `${MODEL_DIR}face_landmarker.task`, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        },
      ),
    )
    .catch((err) => {
      landmarker = null // allow a retry next time the camera is turned on
      throw err
    })
  return landmarker
}

/** useAttention plus the live stream, so the parent's Set-up card can show a preview. */
export function useAttentionWithStream({ enabled, active }: { enabled: boolean; active: boolean }): AttentionApi & { stream: MediaStream | null } {
  const [state, setState] = useState<CameraState>('off')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [signals, setSignals] = useState<AttentionSignals>(IDLE)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    if (!enabled) {
      setState('off')
      return
    }
    let cancelled = false
    let media: MediaStream | null = null
    let timer = 0
    setState('loading')

    const run = async () => {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        const name = (err as DOMException)?.name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
        warnOnce('Camera unavailable; the camera channel is off.', err)
        return
      }
      if (cancelled) return media.getTracks().forEach((t) => t.stop())

      let model: FaceLandmarker
      const video = document.createElement('video')
      try {
        model = await loadLandmarker()
        video.muted = true
        video.playsInline = true
        video.srcObject = media
        await video.play()
      } catch (err) {
        media.getTracks().forEach((t) => t.stop())
        if (cancelled) return
        setState('unavailable')
        warnOnce('Face model unavailable; the camera channel is off.', err)
        return
      }
      if (cancelled) return media.getTracks().forEach((t) => t.stop())
      setStream(media)
      setState('on')

      const tracker = new AttentionTracker()
      let last = IDLE
      const publish = (next: AttentionSignals) => {
        // Round the meter so React only re-renders on visible change.
        next = { ...next, mouthOpen: Math.round(next.mouthOpen * 50) / 50 }
        if (next.looking !== last.looking || next.mouthMoved !== last.mouthMoved || next.mouthOpen !== last.mouthOpen) setSignals((last = next))
      }
      let paused = false
      const tick = () => {
        if (cancelled) return
        timer = window.setTimeout(tick, FRAME_MS)
        if (!activeRef.current || document.visibilityState !== 'visible' || video.readyState < 2) {
          if (!paused) publish(IDLE)
          paused = true
          return
        }
        if (paused) {
          paused = false
          tracker.reset()
        }
        try {
          const t = performance.now()
          const res = model.detectForVideo(video, t)
          const matrix = res.facialTransformationMatrixes?.[0]
          const jaw = res.faceBlendshapes?.[0]?.categories.find((c) => c.categoryName === 'jawOpen')?.score ?? 0
          const pose = matrix ? poseFromMatrix(matrix.data) : { yaw: 0, pitch: 0 }
          publish(tracker.push({ t, face: res.faceLandmarks.length > 0 && !!matrix, ...pose, jawOpen: jaw }))
        } catch (err) {
          warnOnce('Face tracking failed on a frame.', err)
        }
      }
      tick()
    }
    void run()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      media?.getTracks().forEach((t) => t.stop())
      setStream(null)
      setSignals(IDLE)
    }
  }, [enabled])

  return { state: enabled ? state : 'off', ...(enabled ? signals : IDLE), stream }
}

export function useAttention(opts: { enabled: boolean; active: boolean }): AttentionApi {
  const { state, looking, mouthMoved, mouthOpen } = useAttentionWithStream(opts)
  return { state, looking, mouthMoved, mouthOpen }
}
