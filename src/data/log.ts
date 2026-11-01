import type { StorageLike } from './memoryStorage'
import { ACTIVITIES, type ActivityId } from './content'

export type Channel = 'sound' | 'touch' | 'parent'
export type Rung = 'looked' | 'reached' | 'sound' | 'close' | 'word'
export type LogRecord =
  | { kind: 'attempt'; t: number; activity: ActivityId; target: string; channel: Channel; rung?: Rung; prompts: number }
  | { kind: 'sat'; t: number; activity: ActivityId; target: string }
  | { kind: 'session'; t: number; ms: number }

type Attempt = Extract<LogRecord, { kind: 'attempt' }>

export const MAX_RECORDS = 2000
export const RUNGS: Rung[] = ['looked', 'reached', 'sound', 'close', 'word']

const KEY = 'alexspeak.v2.log'
const WEEK = 7 * 24 * 60 * 60 * 1000
const browserStorage = (): StorageLike => globalThis.localStorage

export function loadLog(storage: StorageLike = browserStorage()): LogRecord[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as LogRecord[]) : []
  } catch {
    return []
  }
}

export function appendRecord(r: LogRecord, storage: StorageLike = browserStorage()): void {
  const log = loadLog(storage)
  log.push(r)
  try {
    storage.setItem(KEY, JSON.stringify(log.slice(-MAX_RECORDS)))
  } catch {
    // storage full or blocked: drop the record rather than crash a session
  }
}

export interface WeekSummary {
  plays: number
  attempts: number
  sounds: number
  close: number
  words: number
  requests: number
  favourite: ActivityId | null
  byWord: { target: string; best: Rung | null; count: number }[]
  byActivity: Record<ActivityId, number>
}

/** The rung an attempt counts as: the parent's chip, else 'sound' when the mic fired. */
const effectiveRung = (a: Attempt): Rung | null => a.rung ?? (a.channel === 'sound' ? 'sound' : null)
const better = (a: Rung | null, b: Rung | null) => (RUNGS.indexOf(b as Rung) > RUNGS.indexOf(a as Rung) ? b : a)

export function weekSummary(log: LogRecord[], now: number = Date.now()): WeekSummary {
  const recent = log.filter((r) => r.t > now - WEEK && r.t <= now)
  const attempts = recent.filter((r): r is Attempt => r.kind === 'attempt')
  const byActivity = Object.fromEntries(ACTIVITIES.map((a) => [a.id, 0])) as Record<ActivityId, number>
  const words = new Map<string, { target: string; best: Rung | null; count: number }>()
  for (const a of attempts) {
    byActivity[a.activity] = (byActivity[a.activity] ?? 0) + 1
    const w = words.get(a.target) ?? { target: a.target, best: null, count: 0 }
    w.best = better(w.best, effectiveRung(a))
    w.count += 1
    words.set(a.target, w)
  }
  const top = Math.max(0, ...Object.values(byActivity))
  const count = (rung: Rung) => attempts.filter((a) => effectiveRung(a) === rung).length
  return {
    plays: recent.filter((r) => r.kind === 'session').length,
    attempts: attempts.length,
    sounds: count('sound'),
    close: count('close'),
    words: count('word'),
    requests: byActivity.ask,
    favourite: top > 0 ? (Object.keys(byActivity) as ActivityId[]).find((k) => byActivity[k] === top)! : null,
    byWord: [...words.values()].sort((a, b) => b.count - a.count),
    byActivity,
  }
}

export function wordRungCount(log: LogRecord[], target: string, rung: Rung): number {
  return log.filter((r) => r.kind === 'attempt' && r.target === target && r.rung === rung).length
}

const label = (id: ActivityId) => ACTIVITIES.find((a) => a.id === id)?.label ?? id
const day = (t: number) => new Date(t).toISOString().slice(0, 10)

/** One plain-text page for a speech-language pathologist. */
export function slpSummary(log: LogRecord[], childName: string, now: number = Date.now()): string {
  const w = weekSummary(log, now)
  const recent = log.filter((r) => r.t > now - WEEK && r.t <= now)
  const minutes = Math.round(recent.reduce((n, r) => n + (r.kind === 'session' ? r.ms : 0), 0) / 60000)
  const sat = recent.filter((r) => r.kind === 'sat').length
  const lines = [
    `AlexSpeak practice summary for ${childName}`,
    `Week ending ${day(now)} (last 7 days). Home practice with a parent; any attempt is rewarded, nothing is scored right or wrong.`,
    '',
    'THIS WEEK',
    `Plays: ${w.plays} (about ${minutes} min). Attempts: ${w.attempts}. Sounds: ${w.sounds}. Close: ${w.close}. Words: ${w.words}. Requests: ${w.requests}. Waited without a response: ${sat}.`,
    '',
    'BY ACTIVITY (attempts)',
    ...ACTIVITIES.filter((a) => w.byActivity[a.id] > 0).map((a) => `- ${a.label}: ${w.byActivity[a.id]}`),
    '',
    'BY WORD (best response this week; scale looked < reached < sound < close < word)',
    ...w.byWord.map((r) => `- ${r.target}: ${r.best ?? 'touch / parent saw it'} (${r.count} ${r.count === 1 ? 'try' : 'tries'})`),
    '',
    'LAST 20 ATTEMPTS (date, activity, target, prompts before response, response)',
    ...log
      .filter((r): r is Attempt => r.kind === 'attempt')
      .slice(-20)
      .reverse()
      .map((a) => `- ${day(a.t)}, ${label(a.activity)}, ${a.target}, ${a.prompts}, ${a.rung ?? a.channel}`),
    '',
    'Practice tool, not treatment. Please set goals with your speech-language pathologist.',
  ]
  return lines.join('\n')
}
