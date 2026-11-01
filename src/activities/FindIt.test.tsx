import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { FindIt } from './FindIt'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('FindIt', () => {
  it('asks for one of the three pictures shown', () => {
    const out = renderToStaticMarkup(<FindIt {...props} />)
    const asked = out.match(/touch the <b>(\w+)<\/b>/)?.[1]
    expect(out.match(/class="find-card"/g)).toHaveLength(3)
    expect(out).toContain(`aria-label="${asked}"`)
  })
})
