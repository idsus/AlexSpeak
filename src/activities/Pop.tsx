import { useRef, useState } from 'react'
import type { Target } from '../data/content'
import type { ActivityProps } from './index'
import { useSolo } from './solo'
import './solo.css'

const POP: Target = { id: 'pop', shown: 'pop!', spoken: 'pop' }
const LANES = 5 // ≤ 6 bubbles on screen
const PHASE = [0, 2, 4, 1, 3] // neighbouring lanes start far apart vertically
const RISE_S = 9 // seconds to cross the screen
const POP_MS = 220 // --dur-ui: the fade finishes, then the lane gets a new bubble
const WORD_EVERY = 5
const WORD_MS = 1200

interface Bubble { id: number; lane: number; size: number; popped: boolean }
// sizes 120–168 px, varied but not random so the screen is the same every time
const sizeFor = (id: number) => 120 + ((id * 37) % 49)

/** Bubbles drift up; any touch pops one and says "pop!". Under Calm they sit still in a grid. */
export function Pop({ api }: ActivityProps) {
  const tap = useSolo(api, POP)
  const seq = useRef(LANES)
  const [bubbles, setBubbles] = useState<Bubble[]>(() =>
    Array.from({ length: LANES }, (_, lane) => ({ id: lane, lane, size: sizeFor(lane), popped: false })),
  )
  const [pops, setPops] = useState(0)
  const [word, setWord] = useState(false)
  const wordTimer = useRef(0)

  // a fresh bubble takes the lane's place: from the bottom while moving, in place under Calm
  const renew = (id: number) =>
    setBubbles((list) => list.map((b) => (b.id === id ? { id: ++seq.current, lane: b.lane, size: sizeFor(seq.current), popped: false } : b)))

  function pop(b: Bubble) {
    if (b.popped) return
    tap(POP)
    setBubbles((list) => list.map((x) => (x.id === b.id ? { ...x, popped: true } : x)))
    setTimeout(() => renew(b.id), POP_MS)
    const n = pops + 1
    setPops(n)
    if (n % WORD_EVERY === 0) {
      setWord(true)
      clearTimeout(wordTimer.current)
      wordTimer.current = window.setTimeout(() => setWord(false), WORD_MS)
    }
  }

  return (
    <div className="pop-field hue-uhoh">
      {bubbles.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label="pop the bubble"
          className={b.popped ? 'pop-bubble pop-bubble--popped' : 'pop-bubble'}
          style={{
            width: b.size,
            height: b.size,
            left: `calc((100% - ${b.size}px) * ${(b.lane + 0.5) / LANES})`,
            // the first five start spread up the screen; later ones start at the bottom of their lane
            animationDelay: b.id < LANES ? `${(-PHASE[b.lane] * RISE_S) / LANES}s` : '0s',
          }}
          onPointerDown={() => pop(b)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pop(b) }}
          onAnimationEnd={() => renew(b.id)}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="var(--h-tint)" stroke="var(--h)" strokeWidth="4" />
            <path d="M26 38a28 28 0 0 1 16-16" stroke="var(--surface)" strokeWidth="7" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      ))}
      <p className={word ? 'sc-word pop-word pop-word--on' : 'sc-word pop-word'} aria-hidden="true">{POP.shown}</p>
    </div>
  )
}
