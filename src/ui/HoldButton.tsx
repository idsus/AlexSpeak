import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createHold } from './hold'
import './ui.css'

const STEPS = 3

/**
 * Press-and-hold state for a ring. `step` (0..2) ticks every holdMs/3 so Calm / reduced motion,
 * where the smooth fill transition is switched off, still shows the ring filling in thirds.
 */
export function useHold(holdMs: number, onHold: () => void) {
  const cb = useRef(onHold)
  cb.current = onHold
  const [holding, setHolding] = useState(false)
  const [step, setStep] = useState(0)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const clearTick = () => {
    if (tick.current) clearInterval(tick.current)
    tick.current = null
  }
  const hold = useMemo(
    () => createHold(holdMs, () => {
      clearTick()
      setHolding(false)
      setStep(0)
      cb.current()
    }),
    [holdMs],
  )
  useEffect(() => () => { hold.cancel(); clearTick() }, [hold])

  const start = () => {
    clearTick()
    setHolding(true)
    setStep(0)
    tick.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS - 1)), holdMs / STEPS)
    hold.start()
  }
  const stop = () => {
    clearTick()
    setHolding(false)
    setStep(0)
    hold.cancel()
  }
  const cls = holding ? `hold--on hold--s${step}` : ''
  return { holding, cls, start, stop }
}

/** The 40 px ring: two half-rings rotate in (transform only); children sit in the middle. */
export function HoldRing(props: { children?: ReactNode }) {
  return (
    <span className="hold-ring" aria-hidden="true">
      <span className="hold-half hold-half--r"><span className="hold-arc" /></span>
      <span className="hold-half hold-half--l"><span className="hold-arc" /></span>
      {props.children}
    </span>
  )
}

export const holdStyle = (holdMs: number, color: string) => ({ '--hold': `${holdMs}ms`, '--hold-hue': color }) as CSSProperties

/**
 * Parent-only "I saw it": fires after holdMs of continuous press, so a child's tap does nothing.
 * The ring fills with two rotating half-rings (transform only); release snaps back.
 */
export function HoldButton(props: { label: string; holdMs?: number; hue: string; onHold: () => void; className?: string }) {
  const { label, holdMs = 600, hue, className } = props
  const { cls, start, stop } = useHold(holdMs, props.onHold)
  const isKey = (k: string) => k === ' ' || k === 'Enter'
  const color = /^(#|var\()/.test(hue) ? hue : `var(--hue-${hue})`

  return (
    <button
      type="button"
      className={`hold ${cls} ${className ?? ''}`}
      style={holdStyle(holdMs, color)}
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
      <HoldRing>
        <svg width="40" height="40" viewBox="0 0 40 40" className="hold-check">
          <path d="M13 20l5 5 9-10" fill="none" stroke="var(--ink-2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </HoldRing>
      {label}
    </button>
  )
}
