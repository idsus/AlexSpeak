import { useEffect, useMemo, useState } from 'react'
import { wordForm } from '../data/content'
import { activeMotivators } from '../data/settings'
import { loadLog, wordRungCount } from '../data/log'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './AskForIt.css'

/** One motivator fills the screen; any attempt earns the real thing. */
export function AskForIt({ api, settings, photos, onDone }: ActivityProps) {
  const motivators = useMemo(() => activeMotivators(settings), [settings])
  const [index, setIndex] = useState(0)
  const mot = motivators[index % motivators.length]

  // word form climbs one rung for every three "word" chips the parent has logged
  const target = useMemo(() => {
    const level = Math.min(2, Math.floor(wordRungCount(loadLog(), mot.id, 'word') / 3)) as 0 | 1 | 2
    return wordForm(mot, level)
  }, [mot])

  useEffect(() => {
    let live = true
    api.runTrial(target).then(() => {
      if (!live) return
      onDone()
      setIndex((i) => i + 1)
    })
    return () => { live = false }
    // api/onDone identities may change per render; one trial per target is the contract
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return (
    <div className="ask hue-ask">
      <div className={api.listening ? 'ask-disc ask-disc--listening' : 'ask-disc'}>
        <div className="ask-ring" aria-hidden="true" />
        <div className="ask-face">
          <Glyph id={mot.glyph} hue="ask" size={240} photo={photos[mot.id]} />
        </div>
      </div>
      <p className="word">{target.shown}</p>
    </div>
  )
}
