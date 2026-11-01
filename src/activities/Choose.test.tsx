import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { Choose } from './Choose'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}

describe('Choose', () => {
  it('shows a motivator and a plain item as two cards, motivator first', () => {
    const html = renderToStaticMarkup(<Choose api={api} settings={DEFAULT_SETTINGS} photos={{}} onDone={() => {}} />)
    expect(html.match(/class="choose-card"/g)).toHaveLength(2)
    expect(html.indexOf('>bubbles<')).toBeLessThan(html.indexOf('>sock<'))
  })
})
