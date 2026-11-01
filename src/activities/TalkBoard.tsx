import { useMemo } from 'react'
import { CORE_WORDS, type CoreGlyphId, type GlyphId, type Target } from '../data/content'
import { activeMotivators, displayName } from '../data/settings'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './TalkBoard.css'

const BOARD_TRIAL = { say: false, listening: false, quiet: true } as const

/** Fixed starter board: every touch speaks and counts as talking. Positions never change. */
export function TalkBoard({ api, settings, photos }: ActivityProps) {
  const motivators = useMemo(() => activeMotivators(settings), [settings])

  function tap(word: Target) {
    // a touch-only trial arms synchronously, so the touch resolves it at once (quiet: log + Pip, no overlay)
    void api.runTrial(word, BOARD_TRIAL)
    api.touch()
    void api.say(word.shown)
  }

  const key = (word: Target, glyph: GlyphId | CoreGlyphId, className: string, size: number, photo?: string) => (
    <button
      key={word.id}
      type="button"
      className={className}
      onPointerDown={() => tap(word)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tap(word) }}
    >
      <Glyph id={glyph} hue="board" size={size} photo={photo} />
      {word.shown}
    </button>
  )

  return (
    <div className="board hue-board">
      <div className="board-core">
        {CORE_WORDS.map((w) => key(w, w.glyph, 'board-key', 56))}
      </div>
      <div className="board-things" aria-label={`${displayName(settings.childName)}'s own things`}>
        {motivators.map((m) => key(m, m.glyph, 'board-thing', 48, photos[m.id]))}
      </div>
    </div>
  )
}
