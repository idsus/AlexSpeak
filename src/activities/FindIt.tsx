import { useEffect, useRef, useState } from 'react'
import { FIND_ITEMS, type Motivator, type Target } from '../data/content'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './scenes.css'

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function newRound() {
  const items = shuffle(FIND_ITEMS).slice(0, 3)
  return { items, target: items[Math.floor(Math.random() * items.length)] }
}

/** "touch the dog" with three pictures; whatever is touched is named and celebrated. */
export function FindIt({ api, photos, onDone }: ActivityProps) {
  const [round, setRound] = useState(newRound)
  const [picked, setPicked] = useState<Motivator | null>(null)
  const trial = useRef<Target | null>(null) // set while the trial is waiting for a touch
  const apiRef = useRef(api)
  apiRef.current = api
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let alive = true
    const { target } = round
    // deferred so StrictMode's mount → unmount → mount asks once, not twice
    const start = setTimeout(async () => {
      await apiRef.current.say(`touch the ${target.spoken}`)
      if (!alive) return
      const t: Target = { id: target.id, shown: target.shown, spoken: target.spoken }
      trial.current = t
      await apiRef.current.runTrial(t, { say: false })
      trial.current = null
      if (!alive) return
      doneRef.current()
      setPicked(null)
      setRound(newRound())
    }, 0)
    return () => { alive = false; clearTimeout(start); trial.current = null }
  }, [round])

  function touch(item: Motivator) {
    if (!trial.current || picked) return
    setPicked(item)
    // the frame reads the trial's target when the attempt lands, so it logs and praises the card actually touched
    Object.assign(trial.current, { id: item.id, shown: item.shown, spoken: item.spoken })
    void api.say(item.spoken)
    api.touch()
  }

  return (
    <div className="sc sc--col hue-song">
      {picked ? (
        <p className="sc-word find-named">{picked.shown}!</p>
      ) : (
        <p className="find-ask">
          <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" fill="var(--h)" />
            <path d="M16 8a5 5 0 0 1 0 8" stroke="var(--h)" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <span>touch the <b>{round.target.shown}</b></span>
        </p>
      )}

      <div className="find-cards">
        {round.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={picked?.id === item.id ? 'find-card find-card--picked' : 'find-card'}
            aria-label={item.shown}
            onClick={() => touch(item)}
          >
            <Glyph id={item.glyph} hue="song" size={210} photo={photos[item.id]} />
          </button>
        ))}
      </div>
    </div>
  )
}
