// "What the mic heard": the last few voiced segments that fired or were filtered, with the
// parent's corrections. Metadata only; audio lives in clipStore and only if keepClips is on.
import { safeStorage, type StorageLike } from './memoryStorage'
import { clampParentThreshold } from './settings'

export type Fired = 'voice' | 'energy' | 'parent'
export type Said = 'child' | 'parent'
export interface Heard {
  id: number // Date.now() when it ended; also the clip key
  fired: Fired
  target?: string
  said?: Said // the parent's correction
  clip?: boolean
}

export const MAX_HEARD = 10
const KEY = 'alexspeak.v2.heard'
const STEP = 0.02

export function loadHeard(storage: StorageLike = safeStorage()): Heard[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Heard[]).filter((h) => typeof h?.id === 'number' && typeof h.fired === 'string') : []
  } catch {
    return []
  }
}

function save(list: Heard[], storage: StorageLike): Heard[] {
  const kept = list.slice(-MAX_HEARD)
  try {
    storage.setItem(KEY, JSON.stringify(kept))
  } catch {
    // storage full or blocked: the list is a convenience, never worth crashing for
  }
  return kept
}

export function addHeard(h: Heard, storage: StorageLike = safeStorage()): Heard[] {
  return save([...loadHeard(storage), h], storage)
}

export function markHeard(id: number, said: Said, storage: StorageLike = safeStorage()): Heard[] {
  return save(loadHeard(storage).map((h) => (h.id === id ? { ...h, said } : h)), storage)
}

/** How a correction moves the threshold: only a disagreement with what the engine did counts. */
const nudge = (fired: Fired, said: Said | undefined) =>
  said === 'parent' && fired !== 'parent' ? -STEP : said === 'child' && fired === 'parent' ? STEP : 0

/** "That was me" on a rewarded voice lowers the bar for calling a voice the parent's; "that was {name}" on a filtered one raises it. */
export function correctedThreshold(threshold: number, h: Heard, said: Said): number {
  return clampParentThreshold(threshold + nudge(h.fired, said) - nudge(h.fired, h.said))
}
