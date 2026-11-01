import { describe, it, expect, vi } from 'vitest'
import { DetectionFuser } from './detection'

describe('DetectionFuser', () => {
  it('does nothing while disarmed', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.report('sound')
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('fires once per arming — first channel wins', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.report('touch')
    fuser.report('sound')
    fuser.report('parent')
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith('touch')
  })

  it('re-arming allows the next trial to fire again', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.report('sound')
    fuser.arm()
    fuser.report('parent')
    expect(onAttempt).toHaveBeenCalledTimes(2)
    expect(onAttempt).toHaveBeenLastCalledWith('parent')
  })

  it('disarm blocks late reports', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.disarm()
    fuser.report('sound')
    expect(onAttempt).not.toHaveBeenCalled()
  })
})
