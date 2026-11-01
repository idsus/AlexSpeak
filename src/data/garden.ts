import type { StorageLike } from './memoryStorage'

export interface Garden { stars: number; flowers: number } // stars 0..4

const KEY = 'alexspeak.v2.garden'
const browserStorage = (): StorageLike => globalThis.localStorage

export function loadGarden(storage: StorageLike = browserStorage()): Garden {
  try {
    const g = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (g && Number.isFinite(g.stars) && Number.isFinite(g.flowers)) return { stars: g.stars % 5, flowers: g.flowers }
  } catch {
    // fall through to an empty garden
  }
  return { stars: 0, flowers: 0 }
}

/** Stars are never removed: the fifth empties the jar into a new flower. */
export function addStar(storage: StorageLike = browserStorage()): { garden: Garden; grew: boolean } {
  const g = loadGarden(storage)
  const grew = g.stars + 1 >= 5
  const garden = grew ? { stars: 0, flowers: g.flowers + 1 } : { stars: g.stars + 1, flowers: g.flowers }
  try {
    storage.setItem(KEY, JSON.stringify(garden))
  } catch {
    // storage blocked: the star still shows this session
  }
  return { garden, grew }
}
