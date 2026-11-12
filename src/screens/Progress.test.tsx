import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Progress } from './Progress'
import type { LogRecord } from '../data/log'

const now = Date.UTC(2026, 10, 1, 12)
const day = 24 * 60 * 60 * 1000

describe('Progress', () => {
  it('shows a warm empty state with no data', () => {
    const html = renderToStaticMarkup(<Progress childName="Alex" log={[]} garden={{ stars: 0, flowers: 0 }} now={now} />)
    expect(html).toContain('No plays yet this week — tap Play with Alex and come back.')
    expect(html).toContain('0 flowers grown')
  })

  it('builds the week sentence, word bars and garden from the log', () => {
    const log: LogRecord[] = [
      { kind: 'session', t: now - day, ms: 180000 },
      { kind: 'attempt', t: now - day, activity: 'ask', target: 'bubbles', channel: 'parent', rung: 'word', prompts: 0 },
      { kind: 'attempt', t: now - day, activity: 'ask', target: 'bubbles', channel: 'sound', prompts: 1 },
      { kind: 'attempt', t: now - 30 * day, activity: 'copy', target: 'ba', channel: 'sound', prompts: 0 }, // older than a week
    ]
    const html = renderToStaticMarkup(<Progress childName="Sam" log={log} garden={{ stars: 3, flowers: 9 }} now={now} />)
    expect(html).toContain('played <em>1 time</em>')
    expect(html).toContain('<em>2 tries</em>')
    expect(html).toContain('asked for bubbles 2 times')
    expect(html).not.toContain('>ba<')
    expect(html.match(/var\(--hue-ask\)/g)).toHaveLength(5) // 'word' fills all five segments
    expect(html).toContain('9 flowers grown')
    expect(html).toContain('3 of 5 stars toward the next one')
  })

  it('says "tries that you saw" instead of a zero list, and fills one segment for touched words', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: now - day, activity: 'choose', target: 'car', channel: 'parent', prompts: 0 },
      { kind: 'attempt', t: now - day, activity: 'choose', target: 'car', channel: 'touch', prompts: 0 },
    ]
    const html = renderToStaticMarkup(<Progress childName="  " log={log} garden={{ stars: 0, flowers: 0 }} now={now} />)
    expect(html).toContain('Your child made <em>2 tries</em> that you saw.')
    expect(html).not.toContain('0 sounds')
    expect(html.match(/var\(--hue-choose\)/g)).toHaveLength(1)
    expect(html).toContain('aria-label="touched or seen"')
  })

  it('shows the untapped guess as lighter segments and counts looks', () => {
    const log: LogRecord[] = [
      { kind: 'attempt', t: now - day, activity: 'ask', target: 'more', channel: 'sound', prompts: 0, suggested: 'close', looked: true },
      { kind: 'sat', t: now - day, activity: 'ask', target: 'more', looked: true },
    ]
    const html = renderToStaticMarkup(<Progress childName="Sam" log={log} garden={{ stars: 0, flowers: 0 }} now={now} />)
    expect(html.match(/var\(--hue-ask\)/g)).toHaveLength(4) // up to sound (the mic heard it) plus close
    expect(html.match(/opacity:0.4/g)).toHaveLength(1) // close is only the app's guess, so lighter
    expect(html).toContain("lighter = app&#x27;s guess")
    expect(html).toContain('…and looked 2 times')
  })

  it('adds "played alone" for solo touches without counting them as tries', () => {
    const log: LogRecord[] = [
      { kind: 'session', t: now - day, ms: 60000 },
      { kind: 'attempt', t: now - day, activity: 'colours', target: 'red', channel: 'touch', prompts: 0 },
      { kind: 'attempt', t: now - day, activity: 'colours', target: 'blue', channel: 'touch', prompts: 0 },
    ]
    const html = renderToStaticMarkup(<Progress childName="Sam" log={log} garden={{ stars: 0, flowers: 0 }} now={now} />)
    expect(html).toContain('<em>0 tries</em>')
    expect(html).toContain('…and played alone 2 times.')
  })
})
