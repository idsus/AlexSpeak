import { useEffect, useRef, useState } from 'react'
import { DetectionFuser } from '../engine/detection'
import { micThresholds, type MicLevel } from '../data/settings'
import type { Channel } from '../data/log'
import type { AudioEffortChannelOptions } from './useAudioEffort'

export type MicState = 'off' | 'asking' | 'on' | 'denied'

export interface AttemptApi {
  armed: boolean
  micState: MicState
  level: number // 0..100, live mic volume
  reportTouch(): void
  reportParent(): void
  requestMic(): Promise<void>
}

export interface MicChannelLike {
  resume(): Promise<void>
  pause(): Promise<void>
  destroy(): Promise<void>
  setSensitivity(n: number): void
  setNoiseRejection(n: number): void
}

export type MicFactory = (opts: AudioEffortChannelOptions) => Promise<MicChannelLike>

const defaultFactory: MicFactory = async (opts) => {
  const { AudioEffortChannel } = await import('./useAudioEffort')
  return AudioEffortChannel.create(opts)
}

/** One attempt per arm across mic, touch and the parent's button. React-free so it can be tested. */
export class AttemptController {
  micState: MicState = 'off'
  level = 0
  onChange: () => void = () => {}
  private armed = false
  private channel: MicChannelLike | null = null
  private destroyed = false
  private readonly fuser: DetectionFuser

  constructor(onAttempt: (c: Channel) => void, private readonly factory: MicFactory = defaultFactory) {
    this.fuser = new DetectionFuser(onAttempt)
  }

  setArmed(armed: boolean): void {
    if (armed === this.armed) return
    this.armed = armed
    if (armed) {
      this.fuser.arm()
      void this.channel?.resume()
    } else {
      this.fuser.disarm()
      void this.channel?.pause()
    }
  }

  reportTouch(): void { this.fuser.report('touch') }
  reportParent(): void { this.fuser.report('parent') }

  setMicLevel(level: MicLevel): void {
    const t = micThresholds(level)
    this.channel?.setSensitivity(t.sensitivity)
    this.channel?.setNoiseRejection(t.noiseRejection)
  }

  async requestMic(level: MicLevel): Promise<void> {
    if (this.channel || this.micState === 'asking') return
    this.set('asking')
    try {
      const channel = await this.factory({
        ...micThresholds(level),
        voiceProfile: 'wide', // children's voices vary a lot; never miss an atypical sound
        onAttempt: () => this.fuser.report('sound'),
        onScore: (s) => {
          if (Math.abs(s.volume - this.level) < 2) return
          this.level = s.volume
          this.onChange()
        },
      })
      if (this.destroyed) {
        void channel.destroy()
        return
      }
      this.channel = channel
      void (this.armed ? channel.resume() : channel.pause())
      this.set('on')
    } catch {
      this.set('denied')
    }
  }

  /** Re-attach after a React StrictMode unmount/remount. */
  attach(): void {
    this.destroyed = false
  }

  destroy(): void {
    this.destroyed = true
    void this.channel?.destroy()
    this.channel = null
    if (this.micState !== 'denied') this.micState = 'off'
  }

  private set(state: MicState) {
    this.micState = state
    this.onChange()
  }
}

export function useAttempt(opts: { armed: boolean; micLevel: MicLevel; onAttempt: (c: Channel) => void }): AttemptApi {
  const onAttempt = useRef(opts.onAttempt)
  onAttempt.current = opts.onAttempt
  const [controller] = useState(() => new AttemptController((c) => onAttempt.current(c)))
  const [, rerender] = useState(0)

  useEffect(() => {
    controller.attach()
    controller.onChange = () => rerender((n) => n + 1)
    return () => controller.destroy()
  }, [controller])

  useEffect(() => controller.setArmed(opts.armed), [controller, opts.armed])
  useEffect(() => controller.setMicLevel(opts.micLevel), [controller, opts.micLevel])

  return {
    armed: opts.armed,
    micState: controller.micState,
    level: controller.level,
    reportTouch: () => controller.reportTouch(),
    reportParent: () => controller.reportParent(),
    requestMic: () => controller.requestMic(opts.micLevel),
  }
}
