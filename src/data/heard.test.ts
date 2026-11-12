import { describe, expect, it } from 'vitest'
import { MAX_HEARD, addHeard, correctedThreshold, loadHeard, markHeard } from './heard'
import { offerChildTemplate, saveParentTemplate, templatesFor } from './templates'
import { MemoryStorage } from './memoryStorage'

describe('what the mic heard', () => {
  it('keeps the newest ten and stores corrections', () => {
    const storage = new MemoryStorage()
    for (let i = 0; i < MAX_HEARD + 3; i += 1) addHeard({ id: i, fired: 'voice' }, storage)
    expect(loadHeard(storage).map((h) => h.id)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(markHeard(5, 'parent', storage).find((h) => h.id === 5)?.said).toBe('parent')
  })

  it('nudges the parent threshold only on disagreement, within its clamp, without double counting', () => {
    expect(correctedThreshold(0.45, { id: 1, fired: 'voice' }, 'parent')).toBe(0.43)
    expect(correctedThreshold(0.45, { id: 1, fired: 'parent' }, 'child')).toBe(0.47)
    expect(correctedThreshold(0.45, { id: 1, fired: 'voice' }, 'child')).toBe(0.45)
    expect(correctedThreshold(0.43, { id: 1, fired: 'voice', said: 'parent' }, 'parent')).toBe(0.43)
    expect(correctedThreshold(0.43, { id: 1, fired: 'voice', said: 'parent' }, 'child')).toBe(0.45)
    expect(correctedThreshold(0.7, { id: 1, fired: 'parent' }, 'child')).toBe(0.7)
    expect(correctedThreshold(0.3, { id: 1, fired: 'energy' }, 'parent')).toBe(0.3)
  })
})

describe('closeness templates', () => {
  it('keeps the parent recording and the highest-rated child attempt', () => {
    const storage = new MemoryStorage()
    saveParentTemplate('ball', [[1]], storage)
    offerChildTemplate('ball', 'close', [[2]], storage)
    offerChildTemplate('ball', 'sound', [[3]], storage)
    expect(templatesFor('ball', storage)).toEqual([[[1]], [[2]]])
    offerChildTemplate('ball', 'word', [[4]], storage)
    expect(templatesFor('ball', storage)).toEqual([[[1]], [[4]]])
    expect(templatesFor('cup', storage)).toEqual([])
  })
})
