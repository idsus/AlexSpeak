import { useEffect, useMemo, useRef, useState } from 'react'
import { NEUTRAL_ITEMS, type Motivator, type Target } from '../data/content'
import { activeMotivators } from '../data/settings'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './Choose.css'

/** A wanted thing and a plain thing; whichever is touched is the answer. */
export function Choose({ api, settings, photos, onDone }: ActivityProps) {
  const motivators = useMemo(() => activeMotivators(settings), [settings])
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const trialTarget = useRef<Target | null>(null)

  const want = motivators[round % motivators.length]
  const plain = NEUTRAL_ITEMS[round % NEUTRAL_ITEMS.length]
  const cards: Motivator[] = round % 2 === 0 ? [want, plain] : [plain, want]

  useEffect(() => {
    let live = true
    const target: Target = { id: want.id, shown: want.shown, spoken: want.spoken }
    trialTarget.current = target
    // the trial waits for a touch (or a sound, or the parent's hold) on either card
    api.runTrial(target, { say: false }).then(() => {
      if (!live) return
      onDone()
      setPicked(null)
      setRound((r) => r + 1)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  async function pick(item: Motivator) {
    if (picked) return
    setPicked(item.id)
    // the frame reads the trial's target when the attempt lands, so log and praise the card actually touched
    if (trialTarget.current) Object.assign(trialTarget.current, { id: item.id, shown: item.shown, spoken: item.spoken })
    await api.say(item.shown)
    api.touch()
  }

  return (
    <div className="choose hue-choose">
      {cards.map((item) => (
        <button
          key={item.id}
          type="button"
          className={picked === item.id ? 'choose-card choose-card--picked' : 'choose-card'}
          onPointerDown={() => pick(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pick(item) }}
        >
          <Glyph id={item.glyph} hue="choose" size={220} photo={photos[item.id]} />
          <span className="choose-word">{item.shown}</span>
        </button>
      ))}
    </div>
  )
}
