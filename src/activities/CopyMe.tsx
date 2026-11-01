import { useEffect, useRef, useState } from 'react'
import { COPY_LADDER, type Target } from '../data/content'
import type { TrialOutcome } from './ActivityFrame'
import type { ActivityProps } from './index'
import './scenes.css'

const READY_AFTER = 5
const clampRung = (r: number) => Math.min(COPY_LADDER.length - 1, Math.max(0, Math.round(r) || 0))
// looked / reached come before a sound; everything else counts toward the next-rung hint
const counts = (o: TrialOutcome) => o.kind === 'attempt' && o.rung !== 'looked' && o.rung !== 'reached'

/** Sound imitation ladder: the app models twice, then listens. */
export function CopyMe({ api, settings, onDone }: ActivityProps) {
  const [rung, setRung] = useState(() => clampRung(settings.copyRung))
  const [target, setTarget] = useState<Target>(() => COPY_LADDER[clampRung(settings.copyRung)].targets[0])
  const [tries, setTries] = useState(0)
  const rungRef = useRef(rung)
  rungRef.current = rung
  const apiRef = useRef(api)
  apiRef.current = api
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let alive = true
    // deferred so StrictMode's mount → unmount → mount starts one loop, not two
    const start = setTimeout(async () => {
      let at = rungRef.current
      let i = 0
      while (alive) {
        // a ladder chip tapped mid-trial takes effect on the next target
        if (rungRef.current !== at) { at = rungRef.current; i = 0 }
        const list = COPY_LADDER[at].targets
        const t = list[i % list.length]
        setTarget(t)
        await apiRef.current.say(t.spoken) // first model; runTrial says it the second time
        if (!alive) return
        const outcome = await apiRef.current.runTrial(t)
        if (!alive) return
        if (counts(outcome) && rungRef.current === at) setTries((n) => n + 1)
        i += 1
        doneRef.current()
      }
    }, 0)
    return () => { alive = false; clearTimeout(start) }
  }, [])

  function pickRung(r: number) {
    setRung(r)
    setTries(0)
  }

  return (
    <div className="sc hue-copy">
      <div className={api.listening ? 'sc-ring sc-ring--on copy-ring' : 'sc-ring copy-ring'}>
        <div className="sc-disc">
          <svg width="230" height="230" viewBox="0 0 230 230" role="img" aria-label={`a big open mouth saying ${target.shown}`}>
            <ellipse cx="115" cy="118" rx="84" ry="62" fill="var(--h)" />
            <ellipse cx="115" cy="104" rx="70" ry="20" fill="#FFFFFF" />
            <ellipse cx="115" cy="140" rx="40" ry="20" fill="#F2A6B3" />
          </svg>
        </div>
      </div>

      <div className="copy-side">
        <p className="sc-word copy-word">{target.shown}</p>
        <button type="button" className="chunky copy-again" aria-label="hear it again" onClick={() => api.say(target.spoken)}>
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" fill="#FFFFFF" />
            <path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a9 9 0 0 1 0 13" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          again
        </button>
      </div>

      <div className="sc-chips" role="group" aria-label="Sound ladder (parent)">
        <span className="small-caps">Ladder</span>
        {COPY_LADDER.map((r) => (
          <button
            key={r.rung}
            type="button"
            className={r.rung === rung ? 'chip sc-chip chip--on' : 'chip sc-chip'}
            aria-pressed={r.rung === rung}
            aria-label={`${r.label}: ${r.targets.map((x) => x.shown).join(', ')}`}
            onClick={() => pickRung(r.rung)}
          >
            {r.targets[0].shown}
          </button>
        ))}
        {tries >= READY_AFTER && rung < COPY_LADDER.length - 1 && <p className="sc-hint">Ready for the next rung?</p>}
      </div>
    </div>
  )
}
