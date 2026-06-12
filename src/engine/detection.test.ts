import { describe, it, expect, vi } from 'vitest'
import { DetectionFuser } from './detection'

describe('DetectionFuser', () => {
  it('does nothing while disarmed', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.report('audio')
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('fires once per arming — first channel wins', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.report('mouth')
    fuser.report('audio')
    fuser.report('manual')
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith('mouth')
  })

  it('re-arming allows the next trial to fire again', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.report('audio')
    fuser.arm()
    fuser.report('manual')
    expect(onAttempt).toHaveBeenCalledTimes(2)
    expect(onAttempt).toHaveBeenLastCalledWith('manual')
  })

  it('disarm blocks late reports', () => {
    const onAttempt = vi.fn()
    const fuser = new DetectionFuser(onAttempt)
    fuser.arm()
    fuser.disarm()
    fuser.report('audio')
    expect(onAttempt).not.toHaveBeenCalled()
  })
})
