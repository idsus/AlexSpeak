import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, WORD_LEVELS, loadSettings, saveSettings, wordsForLevel } from './settings'
import { MemoryStorage } from './memoryStorage'

describe('leveled curriculum', () => {
  it('exposes ordered levels, easiest first (letters, then sounds, then words)', () => {
    expect(WORD_LEVELS.map((l) => l.id)).toEqual(['level0', 'level1', 'level2', 'level3'])
    // Level 0 is the alphabet.
    expect(WORD_LEVELS[0].words[0].word).toBe('a')
    expect(WORD_LEVELS[0].words).toHaveLength(26)
    expect(WORD_LEVELS[1].words[0].word).toBe('ma')
  })

  it('wordsForLevel returns normalized, independent copies', () => {
    const a = wordsForLevel('level2')
    const b = wordsForLevel('level2')
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
    a[0].word = 'mutated'
    expect(wordsForLevel('level2')[0].word).not.toBe('mutated')
    // Each entry carries the full shaping-target shape.
    expect(a[0]).toHaveProperty('targetSound')
    expect(a[0]).toHaveProperty('shapingLevel')
  })

  it('falls back to the first level for an unknown level id', () => {
    expect(wordsForLevel('nope' as never)).toEqual(wordsForLevel('level0'))
  })
})

describe('settings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    const storage = new MemoryStorage()
    const custom = { ...DEFAULT_SETTINGS, childName: 'Alex', listenWindowMs: 8000 }
    saveSettings(custom, storage)
    expect(loadSettings(storage)).toEqual(custom)
  })

  it('merges stored partials over defaults so new fields get default values', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.settings', JSON.stringify({ childName: 'Sam' }))
    const loaded = loadSettings(storage)
    expect(loaded.childName).toBe('Sam')
    expect(loaded.maxReprompts).toBe(DEFAULT_SETTINGS.maxReprompts)
  })

  it('normalizes older word entries into shaping targets', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'alexspeak.settings',
      JSON.stringify({ words: [{ word: 'Apple', emoji: '🍎' }] }),
    )
    const loaded = loadSettings(storage)
    expect(loaded.words[0]).toMatchObject({
      word: 'apple',
      emoji: '🍎',
      targetSound: 'apple',
      reward: 'get apple',
      shapingLevel: 'anySound',
    })
  })

  it('relaxes old strict audio thresholds to the more sensitive defaults', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'alexspeak.settings',
      JSON.stringify({ audioEffortThreshold: 60, audioNoiseRejection: 72, childName: 'Alex' }),
    )
    const loaded = loadSettings(storage)
    expect(loaded.audioEffortThreshold).toBeLessThanOrEqual(DEFAULT_SETTINGS.audioEffortThreshold)
    expect(loaded.audioNoiseRejection).toBeLessThanOrEqual(DEFAULT_SETTINGS.audioNoiseRejection)
    expect(loaded.audioAlgorithmVersion).toBe(2)
  })

  it('upgrades old webcam settings to the stricter movement-gated detector', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'alexspeak.settings',
      JSON.stringify({ mouthScoreThreshold: 38, attentionThreshold: 42 }),
    )
    const loaded = loadSettings(storage)
    expect(loaded.mouthScoreThreshold).toBeGreaterThanOrEqual(48)
    expect(loaded.attentionThreshold).toBeGreaterThanOrEqual(62)
    expect(loaded.visionAlgorithmVersion).toBe(2)
  })

  it('survives corrupt stored JSON by falling back to defaults', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.settings', '{not json')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid settings when the stored words field is malformed', () => {
    // A non-array `words` must NOT throw and wipe the caregiver's name,
    // thresholds, and other valid settings via the catch fallback.
    for (const badWords of [null, 'apple', 42, { word: 'apple' }] as unknown[]) {
      const storage = new MemoryStorage()
      storage.setItem(
        'alexspeak.settings',
        JSON.stringify({ childName: 'Robin', listenWindowMs: 7000, words: badWords }),
      )
      const loaded = loadSettings(storage)
      expect(loaded.childName).toBe('Robin')
      expect(loaded.listenWindowMs).toBe(7000)
      expect(loaded.words).toEqual(DEFAULT_SETTINGS.words)
    }
  })

  it('drops malformed entries but keeps the valid ones', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'alexspeak.settings',
      JSON.stringify({
        childName: 'Robin',
        words: [null, { emoji: '🍎' }, { word: 'Ball', emoji: '⚽' }, 'nope'],
      }),
    )
    const loaded = loadSettings(storage)
    expect(loaded.childName).toBe('Robin')
    expect(loaded.words).toHaveLength(1)
    expect(loaded.words[0]).toMatchObject({ word: 'ball', emoji: '⚽' })
  })

  it('defaults are sensitive-but-filtered and start endless at level 1', () => {
    expect(DEFAULT_SETTINGS.audioSensitivity).toBeLessThanOrEqual(0.35)
    expect(DEFAULT_SETTINGS.audioEffortThreshold).toBeLessThanOrEqual(40)
    expect(DEFAULT_SETTINGS.audioNoiseRejection).toBeGreaterThanOrEqual(38)
    expect(DEFAULT_SETTINGS.mouthScoreThreshold).toBeGreaterThanOrEqual(48)
    expect(DEFAULT_SETTINGS.attentionThreshold).toBeGreaterThanOrEqual(60)
    expect(DEFAULT_SETTINGS.maxReprompts).toBeLessThanOrEqual(3)
    expect(DEFAULT_SETTINGS.endlessMode).toBe(true)
    expect(DEFAULT_SETTINGS.voiceMode).toBe('system')
    // Starts at Level 1, leading with the easiest first sounds.
    expect(DEFAULT_SETTINGS.wordLevel).toBe('level1')
    expect(DEFAULT_SETTINGS.words[0].word).toBe('ma')
    expect(DEFAULT_SETTINGS.words.every((w) => w.word.length <= 4)).toBe(true)
  })
})
