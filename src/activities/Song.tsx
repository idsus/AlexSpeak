import { useEffect, useRef, useState } from 'react'
import { SONGS } from '../data/content'
import { Glyph } from '../ui/Glyph'
import type { ActivityProps } from './index'
import './scenes.css'

/** Routine fill-in: the app says the lead, stops, and the pause is the cue. */
export function Song({ api, photos, onDone }: ActivityProps) {
  const [pick, setPick] = useState(0) // chip selection
  const [playing, setPlaying] = useState(0) // song currently on screen
  const pickRef = useRef(pick)
  pickRef.current = pick
  const apiRef = useRef(api)
  apiRef.current = api
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    let alive = true
    // deferred so StrictMode's mount → unmount → mount starts one loop, not two
    const start = setTimeout(async () => {
      while (alive) {
        // a song chip tapped mid-trial takes effect on the next line
        const at = pickRef.current
        const song = SONGS[at]
        setPlaying(at)
        await apiRef.current.say(song.lead)
        if (!alive) return
        await apiRef.current.runTrial(song.blank, { say: false }) // the frame's celebrate line finishes the song
        if (!alive) return
        doneRef.current()
      }
    }, 0)
    return () => { alive = false; clearTimeout(start) }
  }, [])

  const song = SONGS[playing]
  const blankOn = api.listening ? 'sc-ring sc-ring--on song-blank' : 'sc-ring song-blank'

  return (
    <div className="sc sc--col hue-song">
      <div className="song-line">
        {song.lead.split(' ').map((w, i) => <span key={i} className="song-lead">{w}</span>)}
        <span className={api.celebrating ? `${blankOn} song-blank--done` : blankOn} aria-label={`your turn: ${song.blank.shown}`}>
          <span>{song.blank.shown}</span>
        </span>
      </div>

      {song.id === 'ready-set-go' && (
        <svg className="song-art" width="520" height="200" viewBox="0 0 520 200" role="img" aria-label="a little car at the start line, waiting to go">
          <rect x="20" y="160" width="480" height="10" rx="5" fill="var(--line)" />
          <rect x="440" y="40" width="8" height="130" rx="4" fill="var(--h)" />
          <path d="M448 40h52l-12 18 12 18h-52z" fill="var(--h)" />
          <g className={api.celebrating ? 'song-car song-car--go' : 'song-car'}>
            <rect x="60" y="96" width="150" height="56" rx="18" fill="var(--h)" />
            <rect x="90" y="68" width="90" height="44" rx="14" fill="var(--h)" />
            <rect x="104" y="76" width="30" height="26" rx="6" fill="#FFFFFF" />
            <circle cx="96" cy="156" r="18" fill="var(--ink)" /><circle cx="176" cy="156" r="18" fill="var(--ink)" />
            <circle cx="96" cy="156" r="7" fill="#FFFFFF" /><circle cx="176" cy="156" r="7" fill="#FFFFFF" />
          </g>
        </svg>
      )}
      {song.id === 'twinkle' && <Glyph id="star" hue="song" size={180} photo={photos.star} label="a star" />}

      <div className="sc-chips" role="group" aria-label="Songs (parent)">
        <span className="small-caps">Songs</span>
        {SONGS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={i === pick ? 'chip sc-chip chip--on' : 'chip sc-chip'}
            aria-pressed={i === pick}
            onClick={() => setPick(i)}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  )
}
