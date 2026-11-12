import { useState } from 'react'
import { ANIMALS } from '../data/content'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import { useSolo } from './solo'
import './scenes.css'
import './solo.css'

/** Six animal cards that never move; a touch says the animal's sound and shows it big. */
export function Animals({ api }: ActivityProps) {
  const tap = useSolo(api, ANIMALS[0].sound)
  const [last, setLast] = useState<{ i: number; n: number } | null>(null)

  function touch(i: number) {
    tap(ANIMALS[i].sound)
    setLast((l) => ({ i, n: (l?.n ?? 0) + 1 })) // n re-keys the word so the same animal fades in again
  }

  return (
    <div className="sc sc--col hue-song">
      <div className="animal-grid">
        {ANIMALS.map((a, i) => (
          <button
            key={a.glyph}
            type="button"
            className={last?.i === i ? 'animal-card animal-card--on' : 'animal-card'}
            aria-label={a.glyph}
            onPointerDown={() => touch(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') touch(i) }}
          >
            <Glyph id={a.glyph} hue="song" size={160} />
          </button>
        ))}
      </div>
      <p key={last?.n ?? 0} className="sc-word animal-word" aria-live="polite">
        {last ? ANIMALS[last.i].sound.shown : ' '}
      </p>
    </div>
  )
}
