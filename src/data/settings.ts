import type { StorageLike } from './memoryStorage'

export interface WordEntry {
  word: string
  emoji: string
}

export interface Settings {
  childName: string
  words: WordEntry[]
  listenWindowMs: number
  maxReprompts: number
  trialsPerSession: number
  /** VAD positiveSpeechThreshold — lower = more sensitive. Run hot. */
  audioSensitivity: number
  /** jawOpen blendshape threshold — lower = more sensitive. */
  mouthSensitivity: number
  cameraEnabled: boolean
  soundEnabled: boolean
  volume: number
  /** Preferred Web Speech API voice for the fallback TTS; null = browser default. */
  voiceName: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  childName: 'Alex',
  words: [
    { word: 'apple', emoji: '🍎' },
    { word: 'ball', emoji: '⚽' },
    { word: 'up', emoji: '⬆️' },
    { word: 'more', emoji: '🙌' },
  ],
  listenWindowMs: 6000,
  maxReprompts: 2,
  trialsPerSession: 5,
  audioSensitivity: 0.3,
  mouthSensitivity: 0.25,
  cameraEnabled: true,
  soundEnabled: true,
  volume: 0.8,
  voiceName: null,
}

const KEY = 'alexspeak.settings'

const browserStorage = (): StorageLike => globalThis.localStorage

export function loadSettings(storage: StorageLike = browserStorage()): Settings {
  const raw = storage.getItem(KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    // Merge over defaults so settings saved by an older version of the app
    // pick up defaults for any newly added fields.
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings, storage: StorageLike = browserStorage()): void {
  storage.setItem(KEY, JSON.stringify(settings))
}
