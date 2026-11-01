import { useRef, useState, type CSSProperties } from 'react'
import type { ActivityProps } from './index'
import './scenes.css'

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const MAXES = [3, 5, 10] as const
type Max = (typeof MAXES)[number]
// at least two dots, so one number is counted aloud before the gap
const roll = (max: number) => 2 + Math.floor(Math.random() * (max - 1))
const dotSize = (n: number) => (n <= 3 ? 170 : n <= 5 ? 130 : 96)

/** Tap each dot to count; on the last one the app stops and waits for the number. */
export function CountDots({ api, settings, onDone }: ActivityProps) {
  const [max, setMax] = useState<Max>(settings.countMax)
  const [n, setN] = useState(() => roll(settings.countMax))
  const [order, setOrder] = useState<number[]>([]) // dot indices in the order they were tapped
  const maxRef = useRef(max)
  maxRef.current = max
  const busy = useRef(false)
  const atGap = order.length === n

  async function tapDot(i: number) {
    if (busy.current || order.includes(i)) return
    const next = [...order, i]
    setOrder(next)
    if (next.length < n) { void api.say(NUMBER_WORDS[next.length]); return }
    busy.current = true
    const word = NUMBER_WORDS[n]
    await api.say(NUMBER_WORDS.slice(1, n).join(', ') + ',')
    await api.runTrial({ id: word, shown: word, spoken: word }, { say: false })
    onDone()
    setN(roll(maxRef.current))
    setOrder([])
    busy.current = false
  }

  function pickMax(m: Max) {
    setMax(m)
    if (busy.current) return // the round in progress finishes first
    setN(roll(m))
    setOrder([])
  }

  const size = dotSize(n)
  const style = { '--dot': `${size}px`, '--gap': n > 5 ? '16px' : '28px' } as CSSProperties

  return (
    <div className="sc hue-copy">
      <div className="count-dots" style={style}>
        {Array.from({ length: n }, (_, i) => {
          const k = order.indexOf(i) + 1 // 0 = not tapped yet
          const gap = atGap && k === n
          const cls = gap ? 'count-dot count-dot--gap' : k ? 'count-dot count-dot--on' : 'count-dot'
          return (
            <button
              key={i}
              type="button"
              className={cls}
              aria-label={gap ? `dot ${NUMBER_WORDS[k]}, your turn` : k ? `dot ${NUMBER_WORDS[k]}, counted` : 'dot, tap to count'}
              onClick={() => tapDot(i)}
            >
              {gap ? (api.celebrating ? k : '?') : k || ''}
            </button>
          )
        })}
      </div>

      <div className="count-side">
        <div className="count-lead">
          {order.slice(0, atGap ? n - 1 : order.length).map((_, i) => <span key={i}>{NUMBER_WORDS[i + 1]},</span>)}
        </div>
        {atGap && <p className="sc-word count-word">{NUMBER_WORDS[n]}</p>}
      </div>

      <div className="sc-chips" role="group" aria-label="How many dots (parent)">
        <span className="small-caps">Up to</span>
        {MAXES.map((m) => (
          <button key={m} type="button" className={m === max ? 'chip sc-chip chip--on' : 'chip sc-chip'} aria-pressed={m === max} onClick={() => pickMax(m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
