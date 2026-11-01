import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { Song } from './Song'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('Song', () => {
  it('shows the lead and a ghosted blank', () => {
    const out = renderToStaticMarkup(<Song {...props} />)
    expect(out).toContain('>ready,</span>')
    expect(out).toContain('your turn: go')
    expect(out).not.toContain('song-blank--done')
  })
})
