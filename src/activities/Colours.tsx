import { useRef, useState } from 'react'
import type { Target } from '../data/content'
import type { ActivityProps } from './index'
import { useSolo } from './solo'
import './scenes.css'
import './solo.css'

export type ColourId = 'red' | 'blue' | 'yellow'
// shape as well as hue, so a match never depends on seeing colour
export const COLOURS: { id: ColourId; shape: 'circle' | 'square' | 'triangle'; fill: string }[] = [
  { id: 'red', shape: 'circle', fill: 'var(--hue-uhoh)' },
  { id: 'blue', shape: 'square', fill: 'var(--hue-choose)' },
  { id: 'yellow', shape: 'triangle', fill: 'var(--hue-board)' },
]
const SETTLE_MS = 300 // --dur-move

/** Any basket touched is named; a match keeps the blob, a miss sends it gently back. */
export function dropInto(blob: ColourId, basket: ColourId): { match: boolean; word: Target } {
  return { match: blob === basket, word: { id: basket, shown: basket, spoken: basket } }
}
/** The next blob is always a different colour from the one just matched. */
export function nextColour(prev: ColourId, roll: number = Math.random()): ColourId {
  const others = COLOURS.map((c) => c.id).filter((c) => c !== prev)
  return others[Math.min(others.length - 1, Math.floor(roll * others.length))]
}

function Shape({ id, size }: { id: ColourId; size: number }) {
  const c = COLOURS.find((x) => x.id === id)!
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {c.shape === 'circle' && <circle cx="50" cy="50" r="44" fill={c.fill} />}
      {c.shape === 'square' && <rect x="8" y="8" width="84" height="84" rx="16" fill={c.fill} />}
      {c.shape === 'triangle' && <path d="M50 8L94 88H6z" fill={c.fill} stroke="var(--hue-board-deep)" strokeWidth="4" strokeLinejoin="round" />}
    </svg>
  )
}

type Move = { x: number; y: number; match: boolean } | null

export function Colours({ api }: ActivityProps) {
  const [blob, setBlob] = useState<ColourId>('red')
  const [n, setN] = useState(0) // re-keys the blob so a new one fades in
  const [move, setMove] = useState<Move>(null)
  const tap = useSolo(api, dropInto(blob, blob).word)
  const blobRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  function drop(basket: ColourId, el: HTMLElement) {
    const r = dropInto(blob, basket)
    tap(r.word)
    if (busy.current) return // still settling: the word is said, the blob finishes its move
    busy.current = true
    const a = blobRef.current?.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const dx = a ? b.left + b.width / 2 - (a.left + a.width / 2) : 0
    const dy = a ? b.top + b.height / 2 - (a.top + a.height / 2) : 0
    // a miss only dips a third of the way, then floats back up
    setMove(r.match ? { x: dx, y: dy, match: true } : { x: dx / 3, y: dy / 3, match: false })
    setTimeout(() => {
      setMove(null)
      if (r.match) { setBlob((c) => nextColour(c)); setN((k) => k + 1) }
      busy.current = false
    }, SETTLE_MS)
  }

  const style = move ? { transform: `translate(${move.x}px, ${move.y}px) scale(${move.match ? 0.5 : 0.9})`, opacity: move.match ? 0 : 1 } : undefined

  return (
    <div className="sc sc--col hue-choose">
      <div ref={blobRef} key={n} className="col-blob" style={style} role="img" aria-label={blob}>
        <Shape id={blob} size={200} />
      </div>
      <div className="col-baskets">
        {COLOURS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="col-basket"
            aria-label={`${c.id} basket`}
            onPointerDown={(e) => drop(c.id, e.currentTarget)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') drop(c.id, e.currentTarget) }}
          >
            <svg viewBox="0 0 120 100" aria-hidden="true">
              <path d="M8 34h104l-12 58H20z" fill="var(--surface)" stroke={c.fill} strokeWidth="6" strokeLinejoin="round" />
              <path d="M4 30h112" stroke={c.fill} strokeWidth="8" strokeLinecap="round" />
            </svg>
            <span className="col-mark"><Shape id={c.id} size={56} /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
