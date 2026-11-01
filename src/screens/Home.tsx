import { useEffect, useMemo, type ReactElement } from 'react'
import { ACTIVITIES, type ActivityId } from '../data/content'
import { Pip } from '../ui/Pip'
import { Stars } from '../ui/Stars'
import { createHold } from '../ui/hold'
import './home.css'

// Tile pictures from the canvas; the three games got matching simple shapes.
const TILE_ART: Record<ActivityId, ReactElement> = {
  ask: <><circle cx="24" cy="36" r="16" fill="var(--hue-ask)" /><circle cx="44" cy="22" r="10" fill="var(--hue-ask)" /><circle cx="46" cy="44" r="6" fill="var(--hue-ask)" /></>,
  choose: <><rect x="6" y="14" width="22" height="36" rx="8" fill="var(--hue-choose)" /><rect x="36" y="14" width="22" height="36" rx="8" fill="var(--hue-choose)" opacity="0.45" /></>,
  copy: <><ellipse cx="32" cy="34" rx="22" ry="14" fill="var(--hue-copy)" /><ellipse cx="32" cy="36" rx="12" ry="6" fill="#FFFFFF" /></>,
  uhoh: <><rect x="16" y="38" width="32" height="14" rx="4" fill="var(--hue-uhoh)" /><rect x="18" y="22" width="28" height="14" rx="4" fill="var(--hue-uhoh)" /><rect x="30" y="4" width="26" height="14" rx="4" fill="var(--hue-uhoh)" transform="rotate(14 43 11)" /></>,
  song: <><circle cx="20" cy="44" r="9" fill="var(--hue-song)" /><circle cx="44" cy="38" r="9" fill="var(--hue-song)" /><path d="M29 44V14l24-6v30" stroke="var(--hue-song)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  board: <><rect x="8" y="12" width="20" height="18" rx="5" fill="var(--hue-board)" /><rect x="36" y="12" width="20" height="18" rx="5" fill="var(--hue-board)" /><rect x="8" y="36" width="20" height="18" rx="5" fill="var(--hue-board)" /><rect x="36" y="36" width="20" height="18" rx="5" fill="var(--hue-board)" /></>,
  memory: <><rect x="6" y="12" width="24" height="40" rx="7" fill="var(--hue-choose)" /><rect x="34" y="12" width="24" height="40" rx="7" fill="#FFFFFF" stroke="var(--hue-choose)" strokeWidth="4" /><circle cx="46" cy="32" r="6" fill="var(--hue-choose)" /></>,
  count: <><circle cx="14" cy="32" r="8" fill="var(--hue-copy)" /><circle cx="32" cy="32" r="8" fill="var(--hue-copy)" /><circle cx="50" cy="32" r="8" fill="var(--hue-copy)" opacity="0.45" /></>,
  find: <><circle cx="28" cy="28" r="15" fill="none" stroke="var(--hue-song)" strokeWidth="6" /><path d="M39 39l13 13" stroke="var(--hue-song)" strokeWidth="7" strokeLinecap="round" /></>,
}

const FIRST_ROW: ActivityId[] = ['ask', 'choose', 'copy', 'uhoh', 'song', 'board']
const GAMES: ActivityId[] = ['memory', 'count', 'find']

export function Home(props: {
  childName: string
  stars: number
  onPlay: () => void
  onActivity: (id: ActivityId) => void
  onParent: () => void
}) {
  const lock = useMemo(() => createHold(1500, props.onParent), [props.onParent])
  useEffect(() => lock.cancel, [lock])

  const tile = (id: ActivityId) => (
    <button key={id} type="button" className="tile home-tile" onClick={() => props.onActivity(id)}>
      <svg viewBox="0 0 64 64" className="home-tile-art" aria-hidden="true">{TILE_ART[id]}</svg>
      <span>{ACTIVITIES.find((a) => a.id === id)!.label}</span>
    </button>
  )

  return (
    <div className="home">
      <header className="home-top">
        <div className="home-hello">
          <Pip mood="listening" size={72} className="home-pip" />
          <h1 className="title home-name">Hi {props.childName}</h1>
        </div>
        <div className="home-jar">
          <Stars n={props.stars} className="home-stars" />
        </div>
      </header>

      <div className="home-play-wrap">
        <button type="button" className="home-play" aria-label="Play" onClick={props.onPlay}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <nav className="home-tiles" aria-label="Activities">
        {FIRST_ROW.map(tile)}
        {GAMES.map(tile)}
      </nav>

      <button
        type="button"
        className="home-lock"
        aria-label="Parent area (hold 1.5 seconds)"
        onPointerDown={lock.start}
        onPointerUp={lock.cancel}
        onPointerLeave={lock.cancel}
        onPointerCancel={lock.cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && lock.start()}
        onKeyUp={lock.cancel}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="var(--ink-3)" strokeWidth="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="var(--ink-3)" strokeWidth="2" />
        </svg>
      </button>
    </div>
  )
}
