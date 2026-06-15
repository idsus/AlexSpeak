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

  it('always says "<name>, say <sound>!" then the sound, no other filler', () => {
    expect(promptText('Alex', 'ma')).toBe('Alex, say ma! Ma!')
    expect(promptText('Alex', 'y', 'why')).toBe('Alex, say why! Why!')
    expect(listenCoachText('Alex', 'ma')).toBe('Alex, say ma!')
    expect(modelText('Alex', 'ma', 0)).toBe('Alex, say ma! Ma!')
    expect(modelText('Alex', 'ma', 1)).toBe('Alex, say ma! Ma! Ma!')
    // No leftover filler.
    for (const text of [promptText('Alex', 'ma'), modelText('Alex', 'ma', 1), listenCoachText('Alex', 'ma')]) {
      expect(text).toContain('Alex, say')
      expect(text.toLowerCase()).not.toContain('your turn')
      expect(text.toLowerCase()).not.toContain('try')
    }
  })

  it('falls back to "Say <sound>!" when no name is set', () => {
    expect(promptText('', 'ma')).toBe('Say ma! Ma!')
  })
})
