import { describe, it, expect } from 'vitest'
import {
  PRAISE_LINES,
  ENCOURAGE_LINES,
  makePicker,
  promptText,
  modelText,
  listenCoachText,
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
    expect(modelText('apple', 1)).toBe('Try any little sound. Apple.')
    expect(modelText('apple', 2)).toBe('One tiny sound is enough. Apple.')
  })

  it('formats shaping prompts by current rung', () => {
    expect(promptText('Alex', 'apple', 'ah', 'anySound')).toBe(
      'Alex, your turn. Any little sound.',
    )
    expect(promptText('Alex', 'apple', 'ah', 'imitateSound')).toBe(
      'Alex, listen. ah. Your turn.',
    )
    expect(promptText('Alex', 'apple', 'ah', 'approximation')).toBe(
      'Alex, try ah for apple.',
    )
    expect(modelText('apple', 0, 'ah', 'approximation')).toBe('Ah. ... Apple.')
    expect(listenCoachText('Alex', 'apple', 'maa', 'imitateSound')).toBe(
      'Alex, say maa. maa. Your turn.',
    )
  })
})
