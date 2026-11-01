import { describe, it, expect, vi } from 'vitest'
import { AttemptController, type MicChannelLike } from './useAttempt'

function fakeChannel() {
  const calls: string[] = []
  let fire: () => void = () => {}
  const channel: MicChannelLike = {
    resume: async () => void calls.push('resume'),
    pause: async () => void calls.push('pause'),
    destroy: async () => void calls.push('destroy'),
    setSensitivity: () => {},
    setNoiseRejection: () => {},
  }
  const create = vi.fn(async (opts: { onAttempt: () => void }) => {
    fire = opts.onAttempt
    return channel
  })
  return { calls, create, sound: () => fire() }
}

describe('AttemptController', () => {
  it('reports one touch attempt per arm even if touched twice', () => {
    const onAttempt = vi.fn()
    const c = new AttemptController(onAttempt, fakeChannel().create)
    c.setArmed(true)
    c.reportTouch()
    c.reportTouch()
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith('touch')
  })

  it('ignores everything while not armed', async () => {
    const onAttempt = vi.fn()
    const ch = fakeChannel()
    const c = new AttemptController(onAttempt, ch.create)
    await c.requestMic('normal')
    c.reportTouch()
    c.reportParent()
    ch.sound()
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('allows a new attempt after re-arming', () => {
    const onAttempt = vi.fn()
    const c = new AttemptController(onAttempt, fakeChannel().create)
    c.setArmed(true)
    c.reportParent()
    c.setArmed(false)
    c.setArmed(true)
    c.reportTouch()
    expect(onAttempt.mock.calls).toEqual([['parent'], ['touch']])
  })

  it('creates the mic lazily, pauses it while disarmed and reports sound', async () => {
    const onAttempt = vi.fn()
    const ch = fakeChannel()
    const c = new AttemptController(onAttempt, ch.create)
    expect(ch.create).not.toHaveBeenCalled()
    expect(c.micState).toBe('off')
    await c.requestMic('quiet')
    expect(c.micState).toBe('on')
    c.setArmed(true)
    c.setArmed(false)
    expect(ch.calls).toEqual(['pause', 'resume', 'pause'])
    c.setArmed(true)
    ch.sound()
    expect(onAttempt).toHaveBeenCalledWith('sound')
  })

  it('marks the mic denied when permission fails', async () => {
    const c = new AttemptController(vi.fn(), async () => {
      throw new Error('NotAllowedError')
    })
    await c.requestMic('normal')
    expect(c.micState).toBe('denied')
  })
})
