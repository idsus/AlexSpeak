import { describe, expect, it } from 'vitest'
import { ACTIVITIES, MIXED_POOL, activityInfo } from './content'

describe('content', () => {
  it('marks the three play-alone activities solo and keeps them out of the mixed session', () => {
    for (const id of ['pop', 'animals', 'colours'] as const) {
      expect(activityInfo(id).solo).toBe(true)
      expect(activityInfo(id).tip.startsWith('{name} can play this one alone.')).toBe(true)
      expect(MIXED_POOL).not.toContain(id)
    }
    expect(ACTIVITIES.filter((a) => a.solo).map((a) => a.id)).toEqual(['pop', 'animals', 'colours'])
  })
})
