import type { ActivityId } from '../data/content'

/** First pick is uh-oh (engagement); after that the least-played activity, never the same twice. */
export function pickNext(
  pool: ActivityId[],
  counts: Record<ActivityId, number>,
  last: ActivityId | null,
  rng: () => number = Math.random,
): ActivityId {
  if (last === null && pool.includes('uhoh')) return 'uhoh'
  const options = pool.length > 1 ? pool.filter((a) => a !== last) : pool
  const fewest = Math.min(...options.map((a) => counts[a] ?? 0))
  const tied = options.filter((a) => (counts[a] ?? 0) === fewest)
  return tied[Math.min(tied.length - 1, Math.floor(rng() * tied.length))]
}
