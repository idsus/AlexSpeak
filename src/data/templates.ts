// Per-word closeness templates as MFCC frames (never audio): the parent's own recording of the
// word, and the child's attempt the parent rated highest.
import { safeStorage, type StorageLike } from './memoryStorage'
import { RUNGS, type Rung } from './log'

type Frames = number[][]
export interface WordTemplates {
  parent?: Frames
  child?: { rung: Rung; frames: Frames }
}

const KEY = 'alexspeak.v2.templates'
const MAX_FRAMES = 300 // 3 s at 10 ms

export function loadTemplates(storage: StorageLike = safeStorage()): Record<string, WordTemplates> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, WordTemplates>) : {}
  } catch {
    return {}
  }
}

function update(target: string, patch: WordTemplates, storage: StorageLike): void {
  const all = loadTemplates(storage)
  all[target] = { ...all[target], ...patch }
  try {
    storage.setItem(KEY, JSON.stringify(all))
  } catch {
    // storage full: closeness falls back to the shape rule for this word
  }
}

export function templatesFor(target: string, storage: StorageLike = safeStorage()): Frames[] {
  const t = loadTemplates(storage)[target]
  return [t?.parent, t?.child?.frames].filter((f): f is Frames => Array.isArray(f) && f.length > 0)
}

export function saveParentTemplate(target: string, frames: Frames, storage: StorageLike = safeStorage()): void {
  update(target, { parent: frames.slice(0, MAX_FRAMES) }, storage)
}

/** Keeps the child template only if this attempt was rated at least as high as the stored one. */
export function offerChildTemplate(target: string, rung: Rung, frames: Frames, storage: StorageLike = safeStorage()): void {
  const current = loadTemplates(storage)[target]?.child
  if (current && RUNGS.indexOf(current.rung) > RUNGS.indexOf(rung)) return
  update(target, { child: { rung, frames: frames.slice(0, MAX_FRAMES) } }, storage)
}
