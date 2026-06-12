import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings'
import { MemoryStorage } from './memoryStorage'

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

  it('survives corrupt stored JSON by falling back to defaults', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.settings', '{not json')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults are sensory-safe and detector-hot', () => {
    expect(DEFAULT_SETTINGS.audioSensitivity).toBeLessThanOrEqual(0.35)
    expect(DEFAULT_SETTINGS.maxReprompts).toBeLessThanOrEqual(3)
    expect(DEFAULT_SETTINGS.words.length).toBeGreaterThan(0)
  })
})
