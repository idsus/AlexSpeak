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
    expect(w.byWord.find((r) => r.target === 'bubbles')).toEqual({ target: 'bubbles', best: 'close', guess: null, count: 2 })
  })

  it('counts play-alone touches as solo, never as tries, words or the favourite', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: NOW - DAY, activity: 'pop', target: 'pop', channel: 'touch', prompts: 0 },
      { kind: 'attempt', t: NOW - DAY, activity: 'pop', target: 'pop', channel: 'touch', prompts: 0 },
      { kind: 'attempt', t: NOW - DAY, activity: 'animals', target: 'woof', channel: 'sound', prompts: 0 },
      { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'car', channel: 'touch', prompts: 0 },
    ]
    const w = weekSummary(log, NOW)
    expect(w.solo).toBe(3)
    expect(w.attempts).toBe(1)
    expect(w.sounds).toBe(0)
    expect(w.byActivity.pop).toBe(2)
    expect(w.favourite).toBe('ask')
    expect(w.byWord.map((r) => r.target)).toEqual(['car'])
    expect(slpSummary(log, 'Alex', NOW)).toContain('Played alone (touches, not counted as attempts): 3.')
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

  it('drops null and out-of-range records so summaries never throw', () => {
    const storage = new MemoryStorage()
    const ok = { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'car', channel: 'sound', prompts: 0 }
    storage.setItem('alexspeak.v2.log', JSON.stringify([null, { ...ok, t: 'x' }, { ...ok, t: 1e20 }, ok, { ...ok, t: NOW + DAY, target: 'future' }]))
    const log = loadLog(storage)
    expect(log).toHaveLength(2)
    expect(weekSummary(log, NOW).attempts).toBe(1)
    const text = slpSummary(log, 'Alex', NOW)
    expect(text).toContain('car')
    expect(text).not.toContain('future')
  })

  it('keeps logging when localStorage is blocked', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
    try {
      expect(() => appendRecord({ kind: 'session', t: NOW, ms: 1 })).not.toThrow()
      expect(loadLog()).toHaveLength(1)
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})

describe('app guesses and camera in the week summary', () => {
  it('keeps the parent rung as best and only shows a higher, untapped suggestion as a guess', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'more', channel: 'sound', prompts: 0, suggested: 'close', looked: true },
      { kind: 'attempt', t: NOW - DAY, activity: 'ask', target: 'ba', channel: 'sound', prompts: 0, rung: 'word', suggested: 'sound' },
      { kind: 'sat', t: NOW - DAY, activity: 'ask', target: 'ba', looked: true },
    ]
    const w = weekSummary(log, NOW)
    expect(w.byWord.find((r) => r.target === 'more')).toMatchObject({ best: 'sound', guess: 'close' })
    expect(w.byWord.find((r) => r.target === 'ba')).toMatchObject({ best: 'word', guess: null })
    expect(w.close).toBe(0) // the sentence counts stay what the parent saw
    expect(w.looked).toBe(2)
  })
})
