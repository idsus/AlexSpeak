import { describe, it, expect } from 'vitest'
import { addStar, loadGarden } from './garden'
import { MemoryStorage } from './memoryStorage'

describe('garden', () => {
  it('grows a flower on the fifth star', () => {
    const storage = new MemoryStorage()
    expect(loadGarden(storage)).toEqual({ stars: 0, flowers: 0 })
    const grew: boolean[] = []
    let last = loadGarden(storage)
    for (let i = 0; i < 5; i++) {
      const r = addStar(storage)
      grew.push(r.grew)
      last = r.garden
    }
    expect(last).toEqual({ stars: 0, flowers: 1 })
    expect(grew).toEqual([false, false, false, false, true])
    expect(loadGarden(storage)).toEqual({ stars: 0, flowers: 1 })
  })
})
