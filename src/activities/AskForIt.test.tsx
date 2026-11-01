import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { FrameApi } from './ActivityFrame'
import { AskForIt } from './AskForIt'

const api: FrameApi = {
  runTrial: vi.fn(async () => ({ kind: 'sat' as const })),
  say: vi.fn(async () => {}),
  touch: vi.fn(),
  listening: true,
  celebrating: false,
  pipMood: 'listening',
}

describe('AskForIt', () => {
  it('shows the first motivator big inside a breathing listen ring', () => {
    const html = renderToStaticMarkup(<AskForIt api={api} settings={DEFAULT_SETTINGS} photos={{}} onDone={() => {}} />)
    expect(html).toContain('>bubbles</p>')
    expect(html).toContain('ask-disc--listening')
  })
})
