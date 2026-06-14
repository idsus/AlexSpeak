import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SHAPING_LEVELS } from '../data/settings'
import {
  criteriaForTarget,
  criteriaWithAdaptiveSupport,
  nextShapingLevel,
  previousShapingLevel,
  supportLevelForNearAttempts,
} from './shaping'

describe('adaptive shaping', () => {
  it('raises support as near attempts accumulate', () => {
    expect(supportLevelForNearAttempts(0)).toBe(0)
    expect(supportLevelForNearAttempts(2)).toBe(1)
    expect(supportLevelForNearAttempts(4)).toBe(2)
    expect(supportLevelForNearAttempts(6)).toBe(3)
  })

  it('minimizes requirements with each support level', () => {
    const target = { ...DEFAULT_SETTINGS.words[0], shapingLevel: 'word' as const }
    const base = criteriaForTarget(DEFAULT_SETTINGS, target)
    const relaxed = criteriaWithAdaptiveSupport(base, target, 3)

    expect(relaxed.audioEffortThreshold).toBeLessThan(base.audioEffortThreshold)
    expect(relaxed.audioNoiseRejection).toBeLessThan(base.audioNoiseRejection)
    expect(relaxed.mouthScoreThreshold).toBeLessThan(base.mouthScoreThreshold)
    expect(relaxed.attentionThreshold).toBeLessThan(base.attentionThreshold)
    expect(relaxed.acceptMouth).toBe(false)
  })

  it('never allows webcam-only auto success', () => {
    for (const shapingLevel of ['anySound', 'imitateSound', 'approximation', 'word'] as const) {
      const target = { ...DEFAULT_SETTINGS.words[0], shapingLevel }
      const base = criteriaForTarget(DEFAULT_SETTINGS, target)
      expect(base.acceptMouth).toBe(false)
      expect(criteriaWithAdaptiveSupport(base, target, 3).acceptMouth).toBe(false)
    }
  })

  it('steps shaping levels up and down and clamps at the rungs', () => {
    expect(nextShapingLevel('anySound')).toBe('imitateSound')
    expect(nextShapingLevel('approximation')).toBe('word')
    expect(nextShapingLevel('word')).toBe('word') // clamps at the top
    expect(previousShapingLevel('word')).toBe('approximation')
    expect(previousShapingLevel('anySound')).toBe('anySound') // clamps at the floor
  })

  it('makes each higher shaping rung stricter than the one below', () => {
    const thresholds = SHAPING_LEVELS.map(
      (shapingLevel) =>
        criteriaForTarget(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS.words[0], shapingLevel })
          .audioEffortThreshold,
    )
    const ascending = [...thresholds].sort((a, b) => a - b)
    expect(thresholds).toEqual(ascending)
    // 'word' must demand strictly more effort than 'anySound'.
    expect(thresholds[thresholds.length - 1]).toBeGreaterThan(thresholds[0])
  })

  it('keeps relaxed criteria within safe floors even at max support', () => {
    const target = { ...DEFAULT_SETTINGS.words[0], shapingLevel: 'anySound' as const }
    const base = criteriaForTarget(DEFAULT_SETTINGS, target)
    const relaxed = criteriaWithAdaptiveSupport(base, target, 3)
    expect(relaxed.audioEffortThreshold).toBeGreaterThanOrEqual(20)
    expect(relaxed.audioNoiseRejection).toBeGreaterThanOrEqual(32)
    expect(relaxed.attentionThreshold).toBeGreaterThanOrEqual(44)
  })
})
