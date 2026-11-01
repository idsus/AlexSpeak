import type { StorageLike } from './memoryStorage'
import { DEFAULT_MOTIVATORS, NEUTRAL_ITEMS, type Motivator } from './content'

export type MicLevel = 'quiet' | 'normal' | 'loud'

export interface Settings {
  version: 2
  childName: string
  motivatorIds: string[]
  customMotivators: Motivator[]
  copyRung: number
  countMax: 3 | 5 | 10
  sessionMinutes: 2 | 3 | 5
  micLevel: MicLevel
  calm: boolean
  volume: number
  voiceName: string | null
  voiceMode: 'server' | 'system'
  serverVoice: string
  importedLegacy: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  version: 2,
  childName: 'Alex',
  motivatorIds: DEFAULT_MOTIVATORS.slice(0, 4).map((x) => x.id),
  customMotivators: [],
  copyRung: 1,
  countMax: 3,
  sessionMinutes: 3,
  micLevel: 'normal',
  calm: false,
  volume: 0.9,
  voiceName: null,
  voiceMode: 'system',
  serverVoice: 'af_bella',
  importedLegacy: false,
}

const KEY = 'alexspeak.v2.settings'
const LEGACY_KEY = 'alexspeak.settings'
const browserStorage = (): StorageLike => globalThis.localStorage

function readJson(storage: StorageLike, key: string): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function loadSettings(storage: StorageLike = browserStorage()): Settings {
  const stored = readJson(storage, KEY) ?? {}
  const s: Settings = { ...DEFAULT_SETTINGS, ...stored, version: 2 }
  if (!Array.isArray(s.motivatorIds)) s.motivatorIds = DEFAULT_SETTINGS.motivatorIds
  if (!Array.isArray(s.customMotivators)) s.customMotivators = []
  if (typeof s.childName !== 'string') s.childName = DEFAULT_SETTINGS.childName

  if (!s.importedLegacy) {
    // One-time upgrade from the old app: take the name only; the old key is left in place.
    const legacyName = readJson(storage, LEGACY_KEY)?.childName
    if (typeof legacyName === 'string' && legacyName.trim()) s.childName = legacyName.trim()
    s.importedLegacy = true
    saveSettings(s, storage)
  }
  return s
}

export function saveSettings(s: Settings, storage: StorageLike = browserStorage()): void {
  try {
    storage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage full or blocked: keep running with the in-memory settings.
  }
}

const MIC: Record<MicLevel, { sensitivity: number; noiseRejection: number }> = {
  quiet: { sensitivity: 22, noiseRejection: 35 },
  normal: { sensitivity: 32, noiseRejection: 45 },
  loud: { sensitivity: 44, noiseRejection: 60 },
}

export function micThresholds(level: MicLevel): { sensitivity: number; noiseRejection: number } {
  return { ...(MIC[level] ?? MIC.normal) }
}

export function activeMotivators(s: Settings): Motivator[] {
  const all = [...DEFAULT_MOTIVATORS, ...s.customMotivators]
  const picked = s.motivatorIds.flatMap((id) => all.filter((x) => x.id === id))
  return picked.length ? picked : DEFAULT_MOTIVATORS.slice(0, 4)
}

/** Old photos (keyed by old target word) become custom motivators, once; known ids just reuse the photo. */
export function importLegacyPhotos(s: Settings, photoKeys: string[]): Settings {
  const known = new Set([...DEFAULT_MOTIVATORS, ...NEUTRAL_ITEMS, ...s.customMotivators].map((x) => x.id))
  const fresh: Motivator[] = photoKeys
    .filter((k) => !known.has(k))
    .map((k) => ({ id: k, shown: k, spoken: k, glyph: 'star' }))
  if (!fresh.length) return s
  return {
    ...s,
    customMotivators: [...s.customMotivators, ...fresh],
    motivatorIds: [...s.motivatorIds, ...fresh.map((x) => x.id)],
  }
}
