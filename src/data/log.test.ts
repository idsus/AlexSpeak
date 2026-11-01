import { describe, it, expect } from 'vitest'
import { appendRecord, loadLog, weekSummary, slpSummary, wordRungCount, MAX_RECORDS, type LogRecord } from './log'
import { MemoryStorage } from './memoryStorage'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 1, 12)

describe('log', () => {
  it('caps at MAX_RECORDS, keeping the newest', () => {
    const storage = new MemoryStorage()
    for (let i = 0; i < MAX_RECORDS + 5; i++) appendRecord({ kind: 'session', t: i, ms: 1 }, storage)
    const log = loadLog(storage)
    expect(MAX_RECORDS).toBe(2000)
    expect(log).toHaveLength(2000)
    expect(log[0].t).toBe(5)
    expect(log[log.length - 1].t).toBe(MAX_RECORDS + 4)
  })

  it('loads an empty log from corrupt storage', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.v2.log', 'nope')
    expect(loadLog(storage)).toEqual([])
  })

  it('summarises the last 7 days only, counting a sound channel without rung as a sound', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: NOW - 8 * DAY, activity: 'ask', target: 'bubbles', channel: 'sound', prompts: 0 },
      { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'bubbles', channel: 'sound', prompts: 0 },
      { kind: 'attempt', t: NOW - DAY, activity: 'copy', target: 'ba', channel: 'parent', rung: 'word', prompts: 1 },
      { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'bubbles', channel: 'touch', rung: 'close', prompts: 0 },
      { kind: 'sat', t: NOW - DAY, activity: 'song', target: 'go' },
      { kind: 'session', t: NOW - DAY, ms: 180000 },
    ]
    const w = weekSummary(log, NOW)
    expect(w.attempts).toBe(3)
    expect(w.sounds).toBe(1)
    expect(w.close).toBe(1)
    expect(w.words).toBe(1)
    expect(w.requests).toBe(2)
    expect(w.plays).toBe(1)
    expect(w.favourite).toBe('ask')
    expect(w.byActivity.ask).toBe(2)
    expect(w.byActivity.find).toBe(0)
    expect(w.byWord.find((r) => r.target === 'bubbles')).toEqual({ target: 'bubbles', best: 'close', count: 2 })
  })

  it('counts word rungs for a target across all time', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: 1, activity: 'ask', target: 'car', channel: 'parent', rung: 'word', prompts: 0 },
      { kind: 'attempt', t: 2, activity: 'ask', target: 'car', channel: 'sound', prompts: 0 },
      { kind: 'attempt', t: 3, activity: 'ask', target: 'car', channel: 'parent', rung: 'word', prompts: 0 },
    ]
    expect(wordRungCount(log, 'car', 'word')).toBe(2)
  })

  it('writes a plain-text SLP summary with the name and words', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: NOW - 1000, activity: 'ask', target: 'bubbles', channel: 'sound', prompts: 0 },
    ]
    const text = slpSummary(log, 'Alex', NOW)
    expect(text).toContain('Alex')
    expect(text).toContain('bubbles')
  })
})
