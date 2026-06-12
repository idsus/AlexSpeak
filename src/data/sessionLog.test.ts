import { describe, it, expect } from 'vitest'
import { appendTrial, loadLog, summarize, exportJson, type TrialRecord } from './sessionLog'
import { MemoryStorage } from './memoryStorage'

const trial = (overrides: Partial<TrialRecord> = {}): TrialRecord => ({
  timestamp: 1718000000000,
  sessionId: 's1',
  word: 'apple',
  channel: 'audio',
  latencyMs: 1200,
  repromptCount: 0,
  success: true,
  ...overrides,
})

describe('session log', () => {
  it('appends and reloads trials', () => {
    const storage = new MemoryStorage()
    appendTrial(trial(), storage)
    appendTrial(trial({ word: 'ball', success: false, channel: null }), storage)
    const log = loadLog(storage)
    expect(log).toHaveLength(2)
    expect(log[1].word).toBe('ball')
  })

  it('summarizes per session', () => {
    const storage = new MemoryStorage()
    appendTrial(trial(), storage)
    appendTrial(trial({ channel: 'manual', latencyMs: 3000 }), storage)
    appendTrial(trial({ sessionId: 's2', success: false, channel: null, latencyMs: null }), storage)

    const summaries = summarize(loadLog(storage))
    expect(summaries).toHaveLength(2)
    const s1 = summaries.find((s) => s.sessionId === 's1')!
    expect(s1.trials).toBe(3 - 1)
    expect(s1.successes).toBe(2)
    expect(s1.meanLatencyMs).toBe(2100)
    const s2 = summaries.find((s) => s.sessionId === 's2')!
    expect(s2.successes).toBe(0)
    expect(s2.meanLatencyMs).toBeNull()
  })

  it('exports the raw log as JSON for sharing with an SLP', () => {
    const storage = new MemoryStorage()
    appendTrial(trial(), storage)
    const parsed = JSON.parse(exportJson(storage))
    expect(parsed.trials).toHaveLength(1)
    expect(parsed.trials[0].word).toBe('apple')
  })

  it('tolerates a corrupt log by starting fresh', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.log', 'garbage')
    expect(loadLog(storage)).toEqual([])
  })
})
