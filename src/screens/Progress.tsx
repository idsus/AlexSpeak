import { useState } from 'react'
import { ACTIVITIES, activityInfo, type ActivityId } from '../data/content'
import { RUNGS, slpSummary, weekSummary, type LogRecord } from '../data/log'
import type { Garden } from '../data/garden'
import { displayName } from '../data/settings'

const WEEK = 7 * 24 * 60 * 60 * 1000
const MAX_ROWS = 12 // most-tried words only; the SLP summary has the full list

const n = (count: number, one: string, many = one + 's') => `${count} ${count === 1 ? one : many}`

/** The activity each word was last tried in, for the bar colour, plus the most-asked-for thing. */
function wordFacts(log: LogRecord[], now: number) {
  const hueOf = new Map<string, string>()
  const asks = new Map<string, number>()
  for (const r of log) {
    if (r.kind !== 'attempt' || r.t <= now - WEEK || r.t > now) continue
    hueOf.set(r.target, activityInfo(r.activity)?.hue ?? 'song')
    if (r.activity === 'ask') asks.set(r.target, (asks.get(r.target) ?? 0) + 1)
  }
  const topAsk = [...asks.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  return { hueOf, topAsk }
}

export function Progress(props: { childName: string; log: LogRecord[]; garden: Garden; now?: number }) {
  const now = props.now ?? Date.now()
  const dn = displayName(props.childName)
  const name = dn[0].toUpperCase() + dn.slice(1) // starts the sentence
  const [saved, setSaved] = useState(false)
  const w = weekSummary(props.log, now)
  const { hueOf, topAsk } = wordFacts(props.log, now)
  // only the rungs that happened; an all-zero list reads like failure
  const rungs = [w.sounds && n(w.sounds, 'sound'), w.close && `${w.close} close`, w.words && n(w.words, 'word')].filter(Boolean)
  const label = (id: ActivityId) => ACTIVITIES.find((a) => a.id === id)?.label ?? id

  const share = async () => {
    const text = slpSummary(props.log, name, now)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'alexspeak-summary.txt'
    a.click()
    setSaved(true)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="pa-progress">
      <section className="pa-card pa-week" aria-labelledby="pa-week-h">
        <h2 id="pa-week-h" className="pa-label">This week</h2>
        {w.attempts === 0 && w.plays === 0 ? (
          <p className="pa-sentence">No plays yet this week — tap Play with Alex and come back.</p>
        ) : (
          <p className="pa-sentence">
            {name} {w.plays > 0 && <>played <em>{n(w.plays, 'time')}</em> and </>}made <em>{n(w.attempts, 'try', 'tries')}</em>
            {w.attempts > 0 && (rungs.length ? `: ${rungs.join(', ')}` : ' that you saw')}.
            {w.favourite && ` ${name}'s favourite was ${label(w.favourite)}`}
            {w.favourite && (topAsk ? `, and ${name} asked for ${topAsk[0]} ${n(topAsk[1], 'time')}.` : '.')}
          </p>
        )}
      </section>

      <div className="pa-cols">
        <section className="pa-card pa-words" aria-labelledby="pa-words-h">
          <h2 id="pa-words-h" className="pa-label">Words, best so far</h2>
          {w.byWord.length === 0 ? (
            <p className="pa-note">Words {name} tries will show up here.</p>
          ) : (
            <ul className="pa-word-grid">
              {w.byWord.slice(0, MAX_ROWS).map((row) => {
                const filled = row.best ? RUNGS.indexOf(row.best) + 1 : 1 // touched / seen still counts
                return (
                  <li key={row.target} className="pa-word-row">
                    <span className="pa-word">{row.target}</span>
                    <span className="pa-bar" role="img" aria-label={row.best ?? 'touched or seen'}>
                      {RUNGS.map((r, i) => (
                        <i key={r} style={i < filled ? { background: `var(--hue-${hueOf.get(row.target) ?? 'song'})` } : undefined} />
                      ))}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="pa-note pa-legend">{RUNGS.join(' · ')}</p>
        </section>

        <div className="pa-side">
          <section className="pa-card" aria-labelledby="pa-garden-h">
            <h2 id="pa-garden-h" className="pa-label">Garden</h2>
            <p className="pa-big">{n(props.garden.flowers, 'flower')} grown</p>
            <p className="pa-note">{props.garden.stars} of 5 stars toward the next one</p>
          </section>
          <button type="button" className="pa-share" onClick={share}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v12M7 11l5 5 5-5M5 20h14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {saved ? 'Saved' : 'Share with your SLP'}
          </button>
          <p className="pa-note">A one-page summary of dates, activities, prompts and responses. Stays on this tablet until you send it.</p>
        </div>
      </div>
    </div>
  )
}
