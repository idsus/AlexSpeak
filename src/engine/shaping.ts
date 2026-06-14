import {
  SHAPING_LEVELS,
  type Settings,
  type ShapingLevel,
  type WordEntry,
} from '../data/settings'

export interface ShapingCriteria {
  audioEffortThreshold: number
  audioNoiseRejection: number
  mouthScoreThreshold: number
  attentionThreshold: number
  /** Webcam evidence is advisory only; it must not auto-complete a trial. */
  acceptMouth: boolean
}

export interface AdaptiveSupportState {
  nearAttempts: number
  supportLevel: number
  bestAudioScore: number
  bestMouthScore: number
}

const LEVEL_STRICTNESS: Record<ShapingLevel, number> = {
  anySound: -10,
  imitateSound: 0,
  approximation: 8,
  word: 16,
}

export function nextShapingLevel(level: ShapingLevel): ShapingLevel {
  const index = SHAPING_LEVELS.indexOf(level)
  return SHAPING_LEVELS[Math.min(index + 1, SHAPING_LEVELS.length - 1)]
}

export function previousShapingLevel(level: ShapingLevel): ShapingLevel {
  const index = SHAPING_LEVELS.indexOf(level)
  return SHAPING_LEVELS[Math.max(index - 1, 0)]
}

export function criteriaForTarget(settings: Settings, target: WordEntry): ShapingCriteria {
  const strictness = LEVEL_STRICTNESS[target.shapingLevel]
  return {
    audioEffortThreshold: Math.max(24, Math.min(88, settings.audioEffortThreshold + strictness)),
    audioNoiseRejection: Math.max(35, Math.min(92, settings.audioNoiseRejection + strictness * 0.7)),
    mouthScoreThreshold: Math.max(25, Math.min(88, settings.mouthScoreThreshold + strictness)),
    attentionThreshold: Math.max(48, Math.min(90, settings.attentionThreshold + strictness * 0.45)),
    acceptMouth: false,
  }
}

export function createAdaptiveSupportState(): AdaptiveSupportState {
  return {
    nearAttempts: 0,
    supportLevel: 0,
    bestAudioScore: 0,
    bestMouthScore: 0,
  }
}

export function supportLevelForNearAttempts(nearAttempts: number): number {
  if (nearAttempts >= 6) return 3
  if (nearAttempts >= 4) return 2
  if (nearAttempts >= 2) return 1
  return 0
}

export function criteriaWithAdaptiveSupport(
  criteria: ShapingCriteria,
  _target: WordEntry,
  supportLevel: number,
): ShapingCriteria {
  const reduction = supportLevel * 6
  return {
    audioEffortThreshold: Math.max(20, criteria.audioEffortThreshold - reduction),
    audioNoiseRejection: Math.max(32, criteria.audioNoiseRejection - supportLevel * 4),
    mouthScoreThreshold: Math.max(22, criteria.mouthScoreThreshold - reduction),
    attentionThreshold: Math.max(44, criteria.attentionThreshold - supportLevel * 4),
    acceptMouth: false,
  }
}

export function nearAttemptWindow(supportLevel: number): number {
  return 8 + supportLevel * 2
}
