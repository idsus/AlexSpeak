import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { TalkBoard } from './TalkBoard'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: false,
  celebrating: false,
  pipMood: 'listening',
}

describe('TalkBoard', () => {
  it('renders the 8 core words in fixed order, then the motivators', () => {
    const html = renderToStaticMarkup(<TalkBoard api={api} settings={DEFAULT_SETTINGS} photos={{}} onDone={() => {}} />)
    expect(html.match(/class="board-key"/g)).toHaveLength(8)
    const order = ['more', 'all done', 'help', 'open', 'go', 'stop', 'up', 'mine', 'bubbles', 'snack', 'car', 'tickle']
    const at = order.map((w) => html.indexOf(`>${w}</button>`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(html).toContain('Alex&#x27;s own things')
  })
})
