import { describe, it, expect, vi } from 'vitest'
import { createHold } from './hold'

describe('createHold', () => {
  it('does nothing on a short tap and fires after the full hold', () => {
    vi.useFakeTimers()
    const onHold = vi.fn()
    const hold = createHold(600, onHold)
    hold.start()
    vi.advanceTimersByTime(300)
    hold.cancel()
    vi.advanceTimersByTime(1000)
    expect(onHold).not.toHaveBeenCalled()
    hold.start()
    vi.advanceTimersByTime(599)
    expect(onHold).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onHold).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
