import { useEffect, useRef } from 'react'
import { useAttentionWithStream } from './useAttention'
import './vision.css'

/** Parent-only Set-up card. The preview must never appear on a child-facing screen. */
export function CameraSetUp({ enabled, onChange, childName }: { enabled: boolean; onChange: (enabled: boolean) => void; childName: string }) {
  const cam = useAttentionWithStream({ enabled, active: true })
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = cam.stream
    if (cam.stream) v.play().catch(() => {})
  }, [cam.stream])

  const meter = Math.round(cam.mouthOpen * 100)

  return (
    <section className="pa-card" aria-labelledby="pa-cam-h">
      <h2 id="pa-cam-h" className="pa-label">Camera (optional)</h2>
      <div className="pa-setting">
        <div>
          <div className="pa-setting-name" id="pa-cam-name">Watch for looking</div>
          <div className="pa-note">Helps notice when {childName} is paying attention</div>
        </div>
        <button type="button" role="switch" className="pa-switch" aria-checked={enabled} aria-labelledby="pa-cam-name" onClick={() => onChange(!enabled)}>
          <span />
        </button>
      </div>
      <p className="pa-note">
        The camera only notices whether {childName} is looking and whether their mouth moves. No pictures or video are saved, and nothing leaves this tablet.
      </p>

      {enabled && cam.state === 'loading' && <p className="pa-note" role="status">Starting the camera…</p>}
      {cam.state === 'denied' && <p className="pa-note" role="status">The camera is blocked. Allow it in this browser's settings, or leave it off. Everything else still works.</p>}
      {cam.state === 'unavailable' && <p className="pa-note" role="status">The camera could not start on this tablet. Everything else still works.</p>}

      {cam.state === 'on' && (
        <div className="vi-preview">
          <video ref={videoRef} className="vi-video" muted playsInline aria-label="Camera preview, only shown here" />
          <div className="vi-readout">
            <div className="vi-look" role="status">
              <span className={`vi-dot${cam.looking ? ' vi-dot--on' : ''}`} aria-hidden="true" />
              {cam.looking ? 'Looking at the screen' : 'Not looking'}
            </div>
            <div className="pa-meter-row">
              <span className="pa-note">Mouth</span>
              <div className="pa-meter" role="meter" aria-label="Mouth opening" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter}>
                <div style={{ transform: `scaleX(${cam.mouthOpen})` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
