import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { Pop } from './Pop'
import { Animals } from './Animals'
import { Colours, dropInto, nextColour } from './Colours'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: false,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('play-alone activities', () => {
  it('Pop renders five bubbles of at least 120 px and the hidden word', () => {
    const html = renderToStaticMarkup(<Pop {...props} />)
    const sizes = [...html.matchAll(/class="pop-bubble"[^>]*style="width:(\d+)px/g)].map((m) => Number(m[1]))
    expect(sizes).toHaveLength(5)
    expect(sizes.every((s) => s >= 120)).toBe(true)
    expect(html).toContain('class="sc-word pop-word"')
  })

  it('Animals renders six cards in a fixed order and no word before a touch', () => {
    const html = renderToStaticMarkup(<Animals {...props} />)
    const order = ['dog', 'cat', 'cow', 'duck', 'sheep', 'pig'].map((a) => html.indexOf(`aria-label="${a}"`))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).not.toContain('woof')
  })

  it('Colours renders one blob and three baskets with different shapes', () => {
    const html = renderToStaticMarkup(<Colours {...props} />)
    expect(html).toContain('class="col-blob"')
    expect(html.match(/class="col-basket"/g)).toHaveLength(3)
    for (const c of ['red', 'blue', 'yellow']) expect(html).toContain(`aria-label="${c} basket"`)
    expect(html).toMatch(/<circle[\s\S]*<rect[\s\S]*<path d="M50 8L94 88H6z"/)
  })
})

describe('colours matcher', () => {
  it('names the basket touched and matches only the same colour', () => {
    expect(dropInto('red', 'red')).toEqual({ match: true, word: { id: 'red', shown: 'red', spoken: 'red' } })
    expect(dropInto('red', 'blue')).toEqual({ match: false, word: { id: 'blue', shown: 'blue', spoken: 'blue' } })
  })

  it('never repeats the colour just matched', () => {
    for (const roll of [0, 0.49, 0.5, 0.999, 1]) {
      expect(nextColour('red', roll)).not.toBe('red')
      expect(nextColour('yellow', roll)).not.toBe('yellow')
    }
    expect(nextColour('blue', 0)).toBe('red')
    expect(nextColour('blue', 0.9)).toBe('yellow')
  })
})
