import type { StorageLike } from './memoryStorage'

export interface WordEntry {
  word: string
  emoji: string
  targetSound: string
  reward: string
  shapingLevel: ShapingLevel
}

export type ShapingLevel = 'anySound' | 'imitateSound' | 'approximation' | 'word'

export interface Settings {
  childName: string
  /** Which difficulty level's word set is active. */
  wordLevel: WordLevelId
  words: WordEntry[]
  listenWindowMs: number
  maxReprompts: number
  trialsPerSession: number
  /** When true, practice never auto-ends — it cycles the words until Stop. */
  endlessMode: boolean
  /** Legacy setting kept so older saved settings continue to merge cleanly. */
  audioSensitivity: number
  /** Audio effort score threshold, 0..100. Lower = more sensitive. */
  audioEffortThreshold: number
  /** How strictly audio must match Alex-like vocal sound rather than room noise. */
  audioNoiseRejection: number
  /** Internal migration marker for audio-detection sensitivity changes. */
  audioAlgorithmVersion: number
  /** Personalized model confidence threshold, 0..100. */
  personalizedSpeechThreshold: number
  /** Automatically collect high-confidence live samples for the personal model. */
  autoTrainPersonalSpeech: boolean
  /** Frequency band used for Alex's vocalizations. */
  audioVoiceProfile: 'higher' | 'middle' | 'lower' | 'wide'
  /** Legacy setting kept so older saved settings continue to merge cleanly. */
  mouthSensitivity: number
  /** Mouth movement score threshold, 0..100. Lower = more sensitive. */
  mouthScoreThreshold: number
  /** Webcam attention score threshold, 0..100. Lower = more forgiving. */
  attentionThreshold: number
  /** Internal migration marker for webcam scoring changes. */
  visionAlgorithmVersion: number
  cameraEnabled: boolean
  /** Shows live detector internals for tuning. */
  devMode: boolean
  soundEnabled: boolean
  volume: number
  /** 'system' speaks with the chosen browser voice; 'recorded' prefers /clips. */
  voiceMode: 'system' | 'recorded'
  /** Preferred Web Speech API voice for the fallback TTS; null = browser default. */
  voiceName: string | null
}

export const SHAPING_LEVELS: ShapingLevel[] = [
  'anySound',
  'imitateSound',
  'approximation',
  'word',
]

export const SHAPING_LABELS: Record<ShapingLevel, string> = {
  anySound: 'Any intentional sound',
  imitateSound: 'Imitate the sound',
  approximation: 'Approximation',
  word: 'Word',
}

export function normalizeWordEntry(entry: Partial<WordEntry> & { word: string }): WordEntry {
  const word = entry.word.trim().toLowerCase()
  return {
    word,
    emoji: entry.emoji || '⭐',
    targetSound: entry.targetSound?.trim() || word,
    // Preserve an intentionally-empty reward (sound-imitation targets have no
    // tangible reward); only fall back when the field is absent entirely.
    reward: entry.reward !== undefined ? entry.reward.trim() : `get ${word}`,
    shapingLevel: entry.shapingLevel && SHAPING_LEVELS.includes(entry.shapingLevel)
      ? entry.shapingLevel
      : 'anySound',
  }
}

// Coerce whatever was persisted into a clean WordEntry[]. A single malformed
// entry (or a non-array `words`) must not throw, because the caller would then
// discard ALL of the caregiver's settings — name, thresholds, everything.
export function sanitizeWords(value: unknown): WordEntry[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.words.map((w) => ({ ...w }))
  const cleaned = value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const word = (raw as { word?: unknown }).word
    if (typeof word !== 'string' || !word.trim()) return []
    return [normalizeWordEntry(raw as Partial<WordEntry> & { word: string })]
  })
  return cleaned.length ? cleaned : DEFAULT_SETTINGS.words.map((w) => ({ ...w }))
}

export type WordLevelId = 'level1' | 'level2' | 'level3'

export interface WordLevel {
  id: WordLevelId
  label: string
  description: string
  shapingLevel: ShapingLevel
  words: WordEntry[]
}

// Build a level's targets from simple [word, emoji] pairs. The shaping rung is
// set per level (easiest sounds → full words), and these flow through the same
// WordEntry model the rest of the app uses (targetSound, reward, shapingLevel).
function buildLevel(
  id: WordLevelId,
  label: string,
  description: string,
  shapingLevel: ShapingLevel,
  pairs: [string, string][],
): WordLevel {
  return {
    id,
    label,
    description,
    shapingLevel,
    words: pairs.map(([word, emoji]) =>
      normalizeWordEntry({ word, emoji, targetSound: word, reward: '', shapingLevel }),
    ),
  }
}

// Leveled curriculum: pick a difficulty, and endless mode cycles that level's
// words. Level 1 starts with the easiest first sounds and words.
export const WORD_LEVELS: WordLevel[] = [
  buildLevel('level1', 'Level 1', 'First sounds and first words', 'imitateSound', [
    ['ma', '👩'], ['ba', '👄'], ['da', '👨'], ['pa', '👄'], ['hi', '👋'], ['bye', '👋'],
    ['no', '🙅'], ['yes', '👍'], ['up', '⬆️'], ['go', '🚗'], ['more', '🙌'], ['ball', '⚽'],
    ['book', '📘'], ['cup', '🥤'], ['milk', '🥛'], ['eat', '🥄'], ['dog', '🐶'], ['cat', '🐱'],
  ]),
  buildLevel('level2', 'Level 2', 'Common short words', 'approximation', [
    ['mom', '👩'], ['dad', '👨'], ['baby', '👶'], ['duck', '🦆'], ['fish', '🐟'], ['shoe', '👟'],
    ['sock', '🧦'], ['hat', '🧢'], ['bed', '🛏️'], ['bath', '🛁'], ['juice', '🧃'], ['snack', '🍪'],
    ['help', '🤝'], ['mine', '🧸'], ['out', '🚪'], ['down', '⬇️'],
  ]),
  buildLevel('level3', 'Level 3', 'Longer words and harder sound shapes', 'word', [
    ['mama', '👩'], ['dada', '👨'], ['open', '📦'], ['water', '💧'], ['cookie', '🍪'],
    ['banana', '🍌'], ['apple', '🍎'], ['bubbles', '🫧'], ['teddy', '🧸'], ['purple', '🟣'],
    ['yellow', '🟡'], ['turtle', '🐢'], ['happy', '😊'], ['again', '🔁'], ['outside', '🌳'],
  ]),
]

export function wordsForLevel(levelId: WordLevelId): WordEntry[] {
  const level = WORD_LEVELS.find((entry) => entry.id === levelId) ?? WORD_LEVELS[0]
  return level.words.map((word) => ({ ...word }))
}

export const DEFAULT_SETTINGS: Settings = {
  childName: 'Alex',
  wordLevel: 'level1',
  words: wordsForLevel('level1'),
  listenWindowMs: 10000,
  maxReprompts: 2,
  trialsPerSession: 5,
  endlessMode: true,
  audioSensitivity: 0.3,
  audioEffortThreshold: 32,
  audioNoiseRejection: 44,
  audioAlgorithmVersion: 2,
  personalizedSpeechThreshold: 72,
  autoTrainPersonalSpeech: false,
  audioVoiceProfile: 'wide',
  mouthSensitivity: 0.25,
  mouthScoreThreshold: 52,
  attentionThreshold: 64,
  visionAlgorithmVersion: 2,
  cameraEnabled: true,
  devMode: false,
  soundEnabled: true,
  volume: 0.8,
  // Default to the (now warm, auto-picked) system voice so there is no clip
  // 404 round-trip before speaking; switch to 'recorded' once clips exist.
  voiceMode: 'system',
  voiceName: null,
}

const KEY = 'alexspeak.settings'

const browserStorage = (): StorageLike => globalThis.localStorage

export function loadSettings(storage: StorageLike = browserStorage()): Settings {
  const raw = storage.getItem(KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    // Merge over defaults so settings saved by an older version of the app
    // pick up defaults for any newly added fields.
    const settings = { ...DEFAULT_SETTINGS, ...parsed }
    if (!('audioNoiseRejection' in parsed)) {
      settings.audioEffortThreshold = Math.max(
        settings.audioEffortThreshold,
        DEFAULT_SETTINGS.audioEffortThreshold,
      )
    }
    // Relax overly-strict saved audio thresholds to the more sensitive defaults
    // so existing users get the "listens better" behavior without re-tuning.
    if ((parsed.audioAlgorithmVersion ?? 1) < 2) {
      settings.audioEffortThreshold = Math.min(
        settings.audioEffortThreshold,
        DEFAULT_SETTINGS.audioEffortThreshold,
      )
      settings.audioNoiseRejection = Math.min(
        settings.audioNoiseRejection,
        DEFAULT_SETTINGS.audioNoiseRejection,
      )
      settings.audioAlgorithmVersion = 2
    }
    if ((parsed.visionAlgorithmVersion ?? 1) < 2) {
      settings.mouthScoreThreshold = Math.max(settings.mouthScoreThreshold, 48)
      settings.attentionThreshold = Math.max(settings.attentionThreshold, 62)
      settings.visionAlgorithmVersion = 2
    }
    // Sanitize rather than map: a malformed `words` must not throw and wipe
    // every other (valid) setting via the catch below.
    settings.words = sanitizeWords(settings.words)
    return settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings, storage: StorageLike = browserStorage()): void {
  storage.setItem(KEY, JSON.stringify(settings))
}
