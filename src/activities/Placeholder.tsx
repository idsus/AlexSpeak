import { useEffect } from 'react'
import { FIND_ITEMS } from '../data/content'
import { Glyph } from '../ui/Glyph'
import { ListenDisc } from '../ui/ListenDisc'
import type { ActivityProps } from './index'

const STAR = FIND_ITEMS.find((m) => m.id === 'star')!

// Temporary stand-in until each activity is built (deleted in Task 7).
export function Placeholder({ api, onDone }: ActivityProps) {
  const { runTrial } = api
  useEffect(() => {
    let on = true
    void (async () => {
      while (on) {
        await runTrial(STAR)
        if (on) onDone()
      }
    })()
    return () => {
      on = false
    }
  }, [runTrial, onDone])

  return (
    <>
      <ListenDisc listening={api.listening}>
        <Glyph id="star" hue="ask" label="star" />
      </ListenDisc>
      <p className="word">star</p>
    </>
  )
}
