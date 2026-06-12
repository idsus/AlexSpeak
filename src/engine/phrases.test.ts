import { describe, it, expect } from 'vitest'
import {
  PRAISE_LINES,
  ENCOURAGE_LINES,
  makePicker,
  promptText,
  modelText,
} from './phrases'

describe('phrase bank', () => {
  it('has a generous praise bank and at least a few encourage lines', () => {
    expect(PRAISE_LINES.length).toBeGreaterThanOrEqual(15)
    expect(ENCOURAGE_LINES.length).toBeGreaterThanOrEqual(4)
    for (const line of [...PRAISE_LINES, ...ENCOURAGE_LINES]) {
      expect(line.id).toMatch(/^[a-z0-9-]+$/)
      expect(line.text.length).toBeGreaterThan(0)
    }
  })

  it('never repeats the same phrase twice in a row', () => {
    // Force collisions with an rng that always points at the first slot.
    const pick = makePicker(PRAISE_LINES, () => 0)
    const a = pick()
    const b = pick()
    const c = pick()
    expect(b.id).not.toBe(a.id)
    expect(c.id).not.toBe(b.id)
  })

  it('formats prompt and model text warmly', () => {
    expect(promptText('Alex', 'apple')).toBe('Alex, can you say apple?')
    expect(modelText('apple')).toBe('Apple. ... Apple.')
  })
})
