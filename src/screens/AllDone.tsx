import { useEffect, useState } from 'react'
import type { Garden } from '../data/garden'
import { loadLog, type LogRecord } from '../data/log'
import { Pip } from '../ui/Pip'
import { STAR_PATH } from '../ui/Stars'
import './alldone.css'

const COLORS = ['ask', 'choose', 'copy', 'uhoh', 'song', 'board'].map((h) => `var(--hue-${h})`)
const HEIGHTS = [100, 140, 80, 120, 90, 130, 110]
const MAX_SHOWN = 7

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The plain session sentence under the garden. */
export function sessionSentence(name: string, records: LogRecord[], ms: number): string {
  const attempts = records.filter((r) => r.kind === 'attempt')
  const sounds = attempts.filter((a) => (a.rung ?? (a.channel === 'sound' ? 'sound' : null)) === 'sound').length
  const reached = attempts.filter((a) => a.rung === 'reached').length
  const did = [sounds && `made ${plural(sounds, 'sound', 'sounds')}`, reached && `reached ${plural(reached, 'time', 'times')}`].filter(Boolean)
  const tail = did.length ? `${name} ${did.join(' and ')}` : `${name} played with you`
  return `${plural(Math.max(1, Math.round(ms / 60000)), 'minute', 'minutes')} · ${plural(attempts.length, 'try', 'tries')} · ${tail}`
}

function GardenArt({ flowers, grew, name }: { flowers: number; grew: boolean; name: string }) {
  const shown = Math.min(flowers, MAX_SHOWN)
  const step = 400 / (shown + 1)
  const label = `${name}'s garden: ${plural(flowers, 'flower', 'flowers')} grown${grew ? ', one new today' : ''}`
  return (
    <svg className="garden" viewBox="0 0 420 300" role="img" aria-label={label}>
      <rect x="10" y="250" width="400" height="40" rx="20" fill="var(--pip)" />
      {Array.from({ length: shown }, (_, i) => {
        const x = 10 + step * (i + 1)
        const top = 250 - HEIGHTS[i % HEIGHTS.length]
        const r = shown > 4 ? 26 : 36
        return (
          <g key={i}>
            <path d={`M${x} 250V${top}`} stroke="var(--hue-song)" strokeWidth="8" strokeLinecap="round" />
            <circle cx={x} cy={top - r + 4} r={r} fill={COLORS[i % COLORS.length]} />
            <circle cx={x} cy={top - r + 4} r={r * 0.36} fill="var(--star)" />
          </g>
        )
      })}
      {grew && shown > 0 && (
        <g transform={`translate(${10 + step * shown + 18} ${250 - HEIGHTS[(shown - 1) % HEIGHTS.length] - 90})`}>
          <path d={STAR_PATH} fill="var(--star)" transform="scale(1.2)" />
          <path d={STAR_PATH} fill="var(--star)" opacity="0.7" transform="translate(26 30) scale(0.9)" />
        </g>
      )}
    </svg>
  )
}

export function AllDone(props: { childName: string; garden: Garden; grew: boolean; since: number; ms: number; onHome: () => void }) {
  const { childName, garden, grew, since } = props
  // Read after mount: the activity flushes its last record while unmounting.
  const [records, setRecords] = useState<LogRecord[]>([])
  useEffect(() => setRecords(loadLog().filter((r) => r.t >= since)), [since])
  return (
    <div className="alldone hue-song">
      <h1 className="alldone-title">All done!</h1>
      <div className="alldone-scene">
        <GardenArt flowers={garden.flowers} grew={grew} name={childName} />
        <Pip mood="delighted" size={180} className="alldone-pip" />
      </div>
      {grew && (
        <div className="alldone-badge">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} fill="var(--star)" /></svg>
          5 stars — a new flower grew
        </div>
      )}
      <button type="button" className="chunky alldone-home" onClick={props.onHome}>
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="#FFFFFF" /></svg>
        Home
      </button>
      <p className="alldone-sentence">{sessionSentence(childName, records, props.ms)}</p>
    </div>
  )
}
