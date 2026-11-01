import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createHold } from './hold'
import './ui.css'

/**
 * Parent-only "I saw it": fires after holdMs of continuous press, so a child's tap does nothing.
 * The ring fills with two rotating half-rings (transform only); release snaps back.
 */
export function HoldButton(props: { label: string; holdMs?: number; hue: string; onHold: () => void; className?: string }) {
  const { label, holdMs = 600, hue, className } = props
  const onHold = useRef(props.onHold)
  onHold.current = props.onHold
  const [holding, setHolding] = useState(false)
  const hold = useMemo(
    () => createHold(holdMs, () => {
      setHolding(false)
      onHold.current()
    }),
    [holdMs],
  )
  useEffect(() => hold.cancel, [hold])

  const start = () => {
    setHolding(true)
    hold.start()
  }
  const stop = () => {
    setHolding(false)
    hold.cancel()
  }
  const isKey = (k: string) => k === ' ' || k === 'Enter'
  const color = /^(#|var\()/.test(hue) ? hue : `var(--hue-${hue})`

  return (
    <button
      type="button"
      className={`hold ${holding ? 'hold--on' : ''} ${className ?? ''}`}
      style={{ '--hold': `${holdMs}ms`, '--hold-hue': color } as CSSProperties}
      aria-label={`${label} — hold for a moment`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (isKey(e.key) && !e.repeat) start()
      }}
      onKeyUp={(e) => isKey(e.key) && stop()}
      onBlur={stop}
    >
      <span className="hold-ring" aria-hidden="true">
        <span className="hold-half hold-half--r"><span className="hold-arc" /></span>
        <span className="hold-half hold-half--l"><span className="hold-arc" /></span>
        <svg width="40" height="40" viewBox="0 0 40 40" className="hold-check">
          <path d="M13 20l5 5 9-10" fill="none" stroke="var(--ink-2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </button>
  )
}
