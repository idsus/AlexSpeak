import { useEffect, useRef } from 'react'

/** The only permission moment: one plain sentence over the activity, never a wall. */
export function MicCard(props: { childName: string; onYes: () => void; onNo: () => void }) {
  const yes = useRef<HTMLButtonElement>(null)
  useEffect(() => yes.current?.focus(), [])
  return (
    <div className="mic-card" role="dialog" aria-modal="true" aria-labelledby="mic-title" aria-describedby="mic-body">
      <div className="mic-card-head">
        <div className="mic-card-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="var(--h-deep)" />
            <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="var(--h-deep)" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <h2 id="mic-title">Can AlexSpeak listen for {props.childName}'s sounds?</h2>
      </div>
      <p id="mic-body">
        It only notices that a sound happened so it can celebrate. Nothing is recorded, and nothing leaves this
        tablet. You can always use the "I saw it" button instead.
      </p>
      <div className="mic-card-actions">
        <button ref={yes} type="button" className="chunky mic-yes" onClick={props.onYes}>Yes, listen</button>
        <button type="button" className="mic-no" onClick={props.onNo}>Not now</button>
      </div>
    </div>
  )
}
