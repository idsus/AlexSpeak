import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { MemoryMatch } from './MemoryMatch'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('MemoryMatch', () => {
  it('deals six face-down cards, three pairs', () => {
    const out = renderToStaticMarkup(<MemoryMatch {...props} />)
    expect(out.match(/card, face down/g)).toHaveLength(6)
    expect(out).toContain('0 of 3 pairs')
  })
})
