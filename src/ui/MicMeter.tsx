import { useAttempt } from '../audio/useAttempt'
import type { MicLevel } from '../data/settings'

const noop = () => {}

/** Live mic bar for the parent's "how loud" setting. The mic opens only after the parent taps. */
export function MicMeter({ micLevel }: { micLevel: MicLevel }) {
  const mic = useAttempt({ armed: true, micLevel, onAttempt: noop })
  const level = Math.max(0, Math.min(100, Math.round(mic.level)))

  if (mic.micState === 'denied') {
    return <p className="pa-note">The microphone is blocked. Allow it in this browser's settings to test.</p>
  }
  if (mic.micState !== 'on') {
    return (
      <button type="button" className="parent-btn" onClick={() => void mic.requestMic()} disabled={mic.micState === 'asking'}>
        {mic.micState === 'asking' ? 'Waiting for permission…' : 'Turn on the microphone'}
      </button>
    )
  }
  return (
    <div className="pa-meter-row">
      <span className="pa-note">Make a sound to test:</span>
      <div className="pa-meter" role="meter" aria-label="Live mic level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>
        <div style={{ transform: `scaleX(${level / 100})` }} />
      </div>
    </div>
  )
}
