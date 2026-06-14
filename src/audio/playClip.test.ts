import { describe, it, expect } from 'vitest'
import { pickBestVoice, scoreVoice, type VoiceLike } from './playClip'

const v = (name: string, lang: string, localService = false): VoiceLike => ({
  name,
  lang,
  localService,
})

describe('scoreVoice', () => {
  it('prefers natural/neural voices over robotic defaults', () => {
    expect(scoreVoice(v('Microsoft Aria Natural', 'en-US'))).toBeGreaterThan(
      scoreVoice(v('Microsoft David', 'en-US')),
    )
  })

  it('penalizes known robotic voices', () => {
    expect(scoreVoice(v('Microsoft David', 'en-US'))).toBeLessThan(
      scoreVoice(v('Samantha', 'en-US')),
    )
  })

  it('prefers English, and US over other locales', () => {
    expect(scoreVoice(v('Voice', 'en-US'))).toBeGreaterThan(scoreVoice(v('Voice', 'fr-FR')))
    expect(scoreVoice(v('Voice', 'en-US'))).toBeGreaterThanOrEqual(scoreVoice(v('Voice', 'en-GB')))
  })
})

describe('pickBestVoice', () => {
  it('honors the explicit caregiver choice when it still exists', () => {
    const voices = [v('Microsoft David', 'en-US'), v('Samantha', 'en-US')]
    expect(pickBestVoice(voices, 'Microsoft David')?.name).toBe('Microsoft David')
  })

  it('falls back to the warmest English voice when the choice is gone', () => {
    const voices = [
      v('Microsoft David', 'en-US'),
      v('Microsoft Aria Natural', 'en-US'),
      v('Google Deutsch', 'de-DE'),
    ]
    expect(pickBestVoice(voices, 'NonexistentVoice')?.name).toBe('Microsoft Aria Natural')
  })

  it('auto-picks a non-robotic voice when none is chosen', () => {
    const voices = [v('Microsoft David', 'en-US'), v('Microsoft Zira', 'en-US', true)]
    expect(pickBestVoice(voices, null)?.name).toBe('Microsoft Zira')
  })

  it('returns null when there are no voices', () => {
    expect(pickBestVoice([], null)).toBeNull()
  })

  it('uses any voice if no English voice exists', () => {
    expect(pickBestVoice([v('Amélie', 'fr-CA')], null)?.name).toBe('Amélie')
  })
})
