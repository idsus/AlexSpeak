import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { CountDots } from './CountDots'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('CountDots', () => {
  it('shows 2..countMax untapped dots and the up-to chips', () => {
    const out = renderToStaticMarkup(<CountDots {...props} settings={{ ...DEFAULT_SETTINGS, countMax: 3 }} />)
    const dots = out.match(/dot, tap to count/g)?.length ?? 0
    expect(dots).toBeGreaterThanOrEqual(2)
    expect(dots).toBeLessThanOrEqual(3)
    expect(out.match(/"chip sc-chip/g)).toHaveLength(3)
  })
})
