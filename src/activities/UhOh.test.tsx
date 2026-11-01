import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { UhOh } from './UhOh'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('UhOh', () => {
  it('starts on the tower with nothing stacked', () => {
    const out = renderToStaticMarkup(<UhOh {...props} />)
    expect(out).toContain('tap to add a block')
    expect(out.match(/uhoh-part--hidden/g)).toHaveLength(5)
    expect(out).toContain('uh-oh!')
  })
})
