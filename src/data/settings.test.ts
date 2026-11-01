import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, micThresholds, activeMotivators, importLegacyPhotos } from './settings'
import { MemoryStorage } from './memoryStorage'

describe('settings', () => {
  it('returns defaults on a fresh install', () => {
    const s = loadSettings(new MemoryStorage())
    expect({ ...s, importedLegacy: false }).toEqual(DEFAULT_SETTINGS)
    expect(s.childName).toBe('Alex')
    expect(s.motivatorIds).toHaveLength(4)
    expect(s.voiceMode).toBe('system')
  })

  it('imports the legacy child name once and leaves the old key alone', () => {
    const storage = new MemoryStorage()
    const legacy = JSON.stringify({ childName: 'Sam', level: 2 })
    storage.setItem('alexspeak.settings', legacy)
    const first = loadSettings(storage)
    expect(first.childName).toBe('Sam')
    expect(first.importedLegacy).toBe(true)
    expect(storage.getItem('alexspeak.settings')).toBe(legacy)

    saveSettings({ ...first, childName: 'Sammy' }, storage)
    storage.setItem('alexspeak.settings', JSON.stringify({ childName: 'Other' }))
    expect(loadSettings(storage).childName).toBe('Sammy')
  })

  it('survives corrupt storage', () => {
    const storage = new MemoryStorage()
    storage.setItem('alexspeak.v2.settings', '{not json')
    expect(loadSettings(storage).childName).toBe('Alex')
  })

  it('maps mic levels to detector thresholds', () => {
    expect(micThresholds('quiet')).toEqual({ sensitivity: 22, noiseRejection: 35 })
    expect(micThresholds('normal')).toEqual({ sensitivity: 32, noiseRejection: 45 })
    expect(micThresholds('loud')).toEqual({ sensitivity: 44, noiseRejection: 60 })
  })

  it('lists active motivators in chosen order, including custom ones', () => {
    const custom = { id: 'custom-1', shown: 'blanket', spoken: 'blanket', glyph: 'star' as const }
    const s = { ...DEFAULT_SETTINGS, motivatorIds: ['custom-1', 'car'], customMotivators: [custom] }
    expect(activeMotivators(s).map((m) => m.id)).toEqual(['custom-1', 'car'])
  })

  it('turns legacy photo keys into custom motivators, skipping known ones', () => {
    const s = importLegacyPhotos(DEFAULT_SETTINGS, ['ball', 'teddy'])
    expect(s.customMotivators.map((m) => m.id)).toEqual(['teddy'])
    expect(s.motivatorIds).toContain('teddy')
    expect(importLegacyPhotos(s, ['teddy']).customMotivators).toHaveLength(1)
  })
})
