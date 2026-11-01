import { describe, it, expect } from 'vitest'
import { pickNext } from './session'
import type { ActivityId } from '../data/content'

const zero = (): Record<ActivityId, number> => ({ ask: 0, choose: 0, copy: 0, uhoh: 0, song: 0, board: 0, memory: 0, count: 0, find: 0 })
const POOL: ActivityId[] = ['uhoh', 'copy', 'ask', 'choose', 'song', 'memory', 'count']

describe('pickNext', () => {
  it('starts with uh-oh', () => {
    expect(pickNext(POOL, zero(), null)).toBe('uhoh')
  })

  it('never repeats the last activity', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickNext(['uhoh', 'copy'], zero(), 'copy', Math.random)).toBe('uhoh')
    }
  })

  it('picks the activity with the fewest attempts', () => {
    const counts = { ...zero(), uhoh: 5, copy: 4, ask: 3, choose: 1, song: 6, memory: 2, count: 9 }
    expect(pickNext(POOL, counts, 'uhoh')).toBe('choose')
  })
})
