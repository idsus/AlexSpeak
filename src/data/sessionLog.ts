import type { Channel } from '../engine/stateMachine'
import type { StorageLike } from './memoryStorage'

// Local-only progress log. Nothing here ever leaves the device; the export
// button hands the caregiver a JSON file they can choose to share with an SLP.

export interface TrialRecord {
  timestamp: number
  sessionId: string
  word: string
  /** Which channel registered the attempt; null when the trial timed out. */
  channel: Channel | null
  /** Time from listen-window open to first attempt; null on timeout. */
  latencyMs: number | null
  repromptCount: number
  success: boolean
}

export interface SessionSummary {
  sessionId: string
  startedAt: number
  trials: number
  successes: number
  meanLatencyMs: number | null
  channels: Record<string, number>
}

const KEY = 'alexspeak.log'

const browserStorage = (): StorageLike => globalThis.localStorage

export function loadLog(storage: StorageLike = browserStorage()): TrialRecord[] {
  const raw = storage.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendTrial(record: TrialRecord, storage: StorageLike = browserStorage()): void {
  const log = loadLog(storage)
  log.push(record)
  storage.setItem(KEY, JSON.stringify(log))
}

export function summarize(log: TrialRecord[]): SessionSummary[] {
  const bySession = new Map<string, TrialRecord[]>()
  for (const record of log) {
    const list = bySession.get(record.sessionId) ?? []
    list.push(record)
    bySession.set(record.sessionId, list)
  }
  return [...bySession.entries()].map(([sessionId, records]) => {
    const latencies = records
      .map((r) => r.latencyMs)
      .filter((l): l is number => l !== null)
    const channels: Record<string, number> = {}
    for (const r of records) {
      if (r.channel) channels[r.channel] = (channels[r.channel] ?? 0) + 1
    }
    return {
      sessionId,
      startedAt: Math.min(...records.map((r) => r.timestamp)),
      trials: records.length,
      successes: records.filter((r) => r.success).length,
      meanLatencyMs: latencies.length
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null,
      channels,
    }
  })
}

export function exportJson(storage: StorageLike = browserStorage()): string {
  return JSON.stringify({ exportedAt: Date.now(), trials: loadLog(storage) }, null, 2)
}
