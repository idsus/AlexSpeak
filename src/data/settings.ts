import { safeStorage, type StorageLike } from './memoryStorage'
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
  /** Averaged, L2-normalised speaker embeddings of up to two adults. Never audio. */
  parentVoices: number[][]
  /** Median F0 (Hz) per enrolled adult, 0 when unknown; drives the cheap low-voice pre-check. */
  parentPitch: number[]
  /** Cosine similarity at or above which a voice counts as an enrolled adult. */
  parentThreshold: number
  keepClips: boolean
  cameraEnabled: boolean
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
  parentVoices: [],
  parentPitch: [],
  parentThreshold: 0.45,
  keepClips: false,
  cameraEnabled: false,
}

export const MAX_PARENTS = 2
export const PARENT_THRESHOLD_MIN = 0.3
export const PARENT_THRESHOLD_MAX = 0.7
export const clampParentThreshold = (n: number) =>
  Math.round(Math.min(PARENT_THRESHOLD_MAX, Math.max(PARENT_THRESHOLD_MIN, n)) * 100) / 100

const numbers = (x: unknown): x is number[] => Array.isArray(x) && x.every((v) => typeof v === 'number' && Number.isFinite(v))

const KEY = 'alexspeak.v2.settings'
const LEGACY_KEY = 'alexspeak.settings'

function readJson(storage: StorageLike, key: string): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function loadSettings(storage: StorageLike = safeStorage()): Settings {
  const stored = readJson(storage, KEY) ?? {}
  const s: Settings = { ...DEFAULT_SETTINGS, ...stored, version: 2 }
  if (!Array.isArray(s.motivatorIds)) s.motivatorIds = DEFAULT_SETTINGS.motivatorIds
  s.customMotivators = Array.isArray(s.customMotivators) ? s.customMotivators.filter((m) => typeof m?.id === 'string') : []
  if (typeof s.childName !== 'string') s.childName = DEFAULT_SETTINGS.childName
  s.parentVoices = Array.isArray(s.parentVoices) ? s.parentVoices.filter(numbers).slice(0, MAX_PARENTS) : []
  s.parentPitch = s.parentVoices.map((_, i) => (numbers(s.parentPitch) ? (s.parentPitch[i] ?? 0) : 0))
  s.parentThreshold = clampParentThreshold(typeof s.parentThreshold === 'number' ? s.parentThreshold : DEFAULT_SETTINGS.parentThreshold)
  s.keepClips = s.keepClips === true
  s.cameraEnabled = s.cameraEnabled === true

  if (!s.importedLegacy) {
    // One-time upgrade from the old app: take the name only; the old key is left in place.
    const legacyName = readJson(storage, LEGACY_KEY)?.childName
    if (typeof legacyName === 'string' && legacyName.trim()) s.childName = legacyName.trim()
    s.importedLegacy = true
    saveSettings(s, storage)
  }
  return s
}

export function saveSettings(s: Settings, storage: StorageLike = safeStorage()): void {
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

/** The child's name for display; whitespace-only falls back to "your child". */
export const displayName = (s: string) => s.trim() || 'your child'
