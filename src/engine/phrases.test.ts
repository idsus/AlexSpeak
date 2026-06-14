import { describe, it, expect } from 'vitest'
import {
  PRAISE_LINES,
  ENCOURAGE_LINES,
  makePicker,
  promptText,
  modelText,
  listenCoachText,
  elongate,
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

  it('elongate stretches the last vowel', () => {
    expect(elongate('why')).toBe('whyyyyyyy')
    expect(elongate('ma')).toBe('maaaaaaa')
    expect(elongate('')).toBe('')
  })

  it('models just the sound — plain then stretched, no name or filler', () => {
    // Uses the spoken sound, never the name; ends enthusiastically.
    expect(promptText('Alex', 'ma')).toBe('Ma! Maaaaaaa!')
    expect(promptText('Alex', 'y', 'why')).toBe('Why! Whyyyyyyy!')
    expect(listenCoachText('Alex', 'ma')).toBe('Maaaaaaa!')
    expect(modelText('ma', 0)).toBe('Ma! Maaaaaaa!')
    expect(modelText('ma', 1)).toBe('Maaaaaaa! Maaaaaaa!')
    // No leftover filler words anywhere.
    for (const text of [promptText('A', 'ma'), modelText('ma', 1), listenCoachText('A', 'ma')]) {
      expect(text.toLowerCase()).not.toContain('your turn')
      expect(text.toLowerCase()).not.toContain('try')
      expect(text).not.toContain('Alex')
    }
  })
})
