import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { CopyMe } from './CopyMe'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}
const props = { api, settings: DEFAULT_SETTINGS, photos: {}, onDone: () => {} }

describe('CopyMe', () => {
  it('shows the first target of the parent-set rung, the again button and five ladder chips', () => {
    const out = renderToStaticMarkup(<CopyMe {...props} settings={{ ...DEFAULT_SETTINGS, copyRung: 1 }} />)
    expect(out).toContain('>ma</p>')
    expect(out).toContain('again')
    expect(out.match(/"chip sc-chip/g)).toHaveLength(5)
    expect(out).toContain('sc-ring--on')
  })
})
