import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TrialRunner, DEAD_TIME_MS } from './trial'

const star = { id: 'star', shown: 'star', spoken: 'star' }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function setup(speakMs = 1000) {
  const speak = vi.fn(() => sleep(speakMs))
  const runner = new TrialRunner({ speak, sleep })
  return { runner, speak }
}

describe('TrialRunner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays disarmed with the mic shut until speech ends plus the dead time', async () => {
    const { runner } = setup(1000)
    void runner.runTrial(star)
    await vi.advanceTimersByTimeAsync(1000 + DEAD_TIME_MS - 1)
    expect(runner.armed).toBe(false)
    expect(runner.micOpen).toBe(false)
    runner.attempt('sound')
    await vi.advanceTimersByTimeAsync(1)
    expect(runner.armed).toBe(true)
    expect(runner.micOpen).toBe(true)
  })

  it('ignores the mic while the app is speaking, even when armed', async () => {
    const { runner } = setup(1000)
    const outcome = runner.runTrial(star, { say: false, waitMs: 0 })
    expect(runner.armed).toBe(true)
    void runner.say('bubbles')
    runner.attempt('sound')
    runner.attempt('touch')
    await expect(outcome).resolves.toEqual({ kind: 'attempt', channel: 'touch', prompts: 0 })
  })

  it('takes one attempt per trial', async () => {
    const { runner } = setup(0)
    const outcome = runner.runTrial(star, { say: false })
    runner.attempt('parent')
    runner.attempt('touch')
    await expect(outcome).resolves.toEqual({ kind: 'attempt', channel: 'parent', prompts: 0 })
  })

  it('re-models once, then moves on as sat', async () => {
    const { runner, speak } = setup(500)
    const outcome = runner.runTrial(star)
    await vi.advanceTimersByTimeAsync(2 * (500 + DEAD_TIME_MS + 5000))
    await expect(outcome).resolves.toEqual({ kind: 'sat' })
    expect(speak).toHaveBeenCalledTimes(2)
  })

  it('counts the re-model in prompts', async () => {
    const { runner } = setup(500)
    const outcome = runner.runTrial(star)
    await vi.advanceTimersByTimeAsync(500 + DEAD_TIME_MS + 5000 + 500 + DEAD_TIME_MS)
    runner.attempt('sound')
    await expect(outcome).resolves.toEqual({ kind: 'attempt', channel: 'sound', prompts: 1 })
  })
})
