import type { Motivator, Target } from '../data/content'
import { RUNGS, type Rung } from '../data/log'
import { Glyph } from '../ui/Glyph'
import { STAR_PATH } from '../ui/Stars'

// Six soft stars, positions from the canvas (1180×700 stage), drifting up and fading once.
const DRIFT = [
  { x: 150, y: 420, s: 1, o: 1 }, { x: 260, y: 300, s: 1.3, o: 0.8 }, { x: 930, y: 330, s: 1, o: 1 },
  { x: 1030, y: 470, s: 1.3, o: 0.7 }, { x: 860, y: 160, s: 0.85, o: 0.6 }, { x: 330, y: 540, s: 0.85, o: 0.6 },
]

/** The celebrate moment: white disc with the picture, the word in the deep hue, stars drifting. */
export function CelebrateOverlay(props: { target: Target; photo?: string | null; hue: string }) {
  const { target, photo, hue } = props
  const glyph = (target as Partial<Motivator>).glyph ?? 'star'
  return (
    <div className="celebrate" aria-live="polite">
      <svg className="celebrate-stars" viewBox="0 0 1180 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {DRIFT.map((d, i) => (
          <g key={i} className="celebrate-star" style={{ animationDelay: `${i * 60}ms` }}>
            <path d={STAR_PATH} fill="var(--star)" opacity={d.o} transform={`translate(${d.x - 24 * d.s} ${d.y - 24 * d.s}) scale(${2 * d.s})`} />
          </g>
        ))}
      </svg>
      <div className="celebrate-disc">
        <Glyph id={glyph} hue={hue} photo={photo} label={target.shown} />
      </div>
      <p className="word celebrate-word">{target.shown}!</p>
    </div>
  )
}

/** Optional parent chips after a celebrate: what did the child do? */
export function RungChips(props: { selected: Rung | null; leaving: boolean; childName: string; onPick: (r: Rung) => void }) {
  return (
    <div className={`chips ${props.leaving ? 'chips--leaving' : ''}`} role="group" aria-label={`What did ${props.childName} do? Optional, for the parent`}>
      {RUNGS.map((r) => (
        <button
          key={r}
          type="button"
          className={`chip ${props.selected === r ? 'chip--on' : ''}`}
          aria-pressed={props.selected === r}
          onClick={() => props.onPick(r)}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
