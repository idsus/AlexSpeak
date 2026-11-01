import { useRef, useState } from 'react'
import { FIND_ITEMS, type Motivator } from '../data/content'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './scenes.css'

const PAIRS = 3
const PEEK_MS = 1000 // how long a non-matching pair stays face up

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const deal = (): Motivator[] => {
  const items = shuffle(FIND_ITEMS).slice(0, PAIRS)
  return shuffle([...items, ...items])
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Six cards, three pairs, taking turns; every match ends in a word to try. */
export function MemoryMatch({ api, photos, onDone }: ActivityProps) {
  const [cards, setCards] = useState(deal)
  const [open, setOpen] = useState<number[]>([]) // face-up, not yet matched
  const [matched, setMatched] = useState<string[]>([])
  const [named, setNamed] = useState<Motivator | null>(null)
  const busy = useRef(false)

  async function flip(i: number) {
    if (busy.current || open.includes(i) || matched.includes(cards[i].id)) return
    const next = [...open, i]
    setOpen(next)
    if (next.length < 2) return
    busy.current = true
    const [a, b] = next.map((k) => cards[k])
    if (a.id !== b.id) {
      await wait(PEEK_MS)
      setOpen([])
      busy.current = false
      return
    }
    const pairs = matched.length + 1
    setMatched((m) => [...m, a.id])
    setOpen([])
    setNamed(a)
    await api.runTrial(a)
    if (pairs === PAIRS) {
      onDone()
      setCards(deal())
      setMatched([])
      setNamed(null)
    }
    busy.current = false
  }

  return (
    <div className="sc hue-choose">
      <div className="mm-grid">
        {cards.map((item, i) => {
          const up = open.includes(i) || matched.includes(item.id)
          return (
            <button
              key={i}
              type="button"
              className={up ? 'mm-card mm-card--up' : 'mm-card'}
              aria-label={up ? `card, face up: ${item.shown}` : 'card, face down'}
              onClick={() => flip(i)}
            >
              <span className="mm-inner">
                <span className="mm-face mm-back">
                  <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="var(--surface)" opacity="0.5" />
                  </svg>
                </span>
                <span className="mm-face mm-front">
                  <Glyph id={item.glyph} hue="choose" size={110} photo={photos[item.id]} />
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mm-side">
        <div className={api.listening ? 'sc-ring sc-ring--on mm-ring' : 'sc-ring mm-ring'}>
          {named && <Glyph id={named.glyph} hue="choose" size={130} photo={photos[named.id]} label={named.shown} />}
        </div>
        {named && <p className="sc-word mm-word">{named.shown}!</p>}
        <p className="sc-hint">{matched.length} of {PAIRS} pairs</p>
      </div>
    </div>
  )
}
