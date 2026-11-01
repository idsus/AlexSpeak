import type { Target } from '../data/content'
import type { Channel, Rung } from '../data/log'

export type TrialOutcome = { kind: 'attempt'; channel: Channel; rung?: Rung; prompts: number } | { kind: 'sat' }
export interface TrialOptions {
  say?: boolean // default true: model the word before listening
  waitMs?: number // default 5000; <= 0 waits until an attempt
  listening?: boolean // default true: mic + listen ring; false = touch / parent only
  quiet?: boolean // no celebrate overlay or star: log + Pip delighted only (talk board)
}

export const DEAD_TIME_MS = 400
const NEVER = new Promise<never>(() => {})

export interface RunnerDeps {
  speak(text: string): Promise<void>
  sleep(ms: number): Promise<void>
  /** Mic permission moment; needed() is checked synchronously so touch-only trials arm at once. */
  micCard?: { needed(): boolean; ask(): Promise<void> }
}

/**
 * The listen cycle: model → dead time → listen → re-model once → listen → 'sat'.
 * The mic only opens when armed, listening and nothing has been spoken for DEAD_TIME_MS,
 * so the app's own voice (or the parent's model) never counts. React-free for tests.
 */
export class TrialRunner {
  armed = false
  micOpen = false
  onChange: () => void = () => {}
  private run = 0
  private speaking = 0
  listening = true
  private pending: ((c: Channel) => void) | null = null

  constructor(private readonly deps: RunnerDeps) {}

  async say(text: string): Promise<void> {
    this.speaking += 1
    this.sync()
    try {
      await this.deps.speak(text)
      await this.deps.sleep(DEAD_TIME_MS)
    } finally {
      this.speaking -= 1
      this.sync()
    }
  }

  /** Any channel; the first one per trial wins. Sound only counts while the mic is open. */
  attempt(c: Channel): void {
    if (!this.pending || (c === 'sound' && !this.micOpen)) return
    const resolve = this.pending
    this.pending = null
    resolve(c)
  }

  /** Stop the current trial; its promise never resolves (the activity is going away). */
  cancel(): void {
    this.run += 1
    this.pending = null
    this.setArmed(false)
  }

  runTrial(target: Target, opts: TrialOptions = {}): Promise<TrialOutcome> {
    const { say = true, waitMs = 5000, listening = true } = opts
    const id = ++this.run
    const live = () => id === this.run
    this.pending = null
    this.listening = listening
    this.setArmed(false)
    return (async (): Promise<TrialOutcome> => {
      if (listening && this.deps.micCard?.needed()) await this.deps.micCard.ask()
      for (let prompts = 0; prompts < 2; prompts++) {
        if (!live()) return NEVER
        if (say) await this.say(target.spoken)
        if (!live()) return NEVER
        const channel = await this.listen(waitMs)
        if (!live()) return NEVER
        this.setArmed(false)
        if (channel) return { kind: 'attempt', channel, prompts }
      }
      return { kind: 'sat' }
    })()
  }

  private async listen(waitMs: number): Promise<Channel | null> {
    const got = new Promise<Channel>((resolve) => (this.pending = resolve))
    this.setArmed(true)
    const timeout = waitMs > 0 ? this.deps.sleep(waitMs).then(() => null) : NEVER
    const channel = await Promise.race([got, timeout])
    this.pending = null
    return channel
  }

  private setArmed(armed: boolean) {
    this.armed = armed
    this.sync()
  }

  private sync() {
    const micOpen = this.armed && this.listening && this.speaking === 0
    this.micOpen = micOpen
    this.onChange()
  }
}
