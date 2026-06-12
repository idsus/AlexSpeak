import type { Channel } from './stateMachine'

// Fuses the three detection channels (audio VAD, mouth movement, caregiver
// button) into a single onAttempt callback. Armed for the whole trial;
// the first channel to report wins and later reports are ignored until
// the next arm() — one celebration per trial, regardless of how many
// detectors fire.
export class DetectionFuser {
  private armed = false
  private fired = false

  constructor(private readonly onAttempt: (channel: Channel) => void) {}

  arm(): void {
    this.armed = true
    this.fired = false
  }

  disarm(): void {
    this.armed = false
  }

  report(channel: Channel): void {
    if (!this.armed || this.fired) return
    this.fired = true
    this.onAttempt(channel)
  }
}
