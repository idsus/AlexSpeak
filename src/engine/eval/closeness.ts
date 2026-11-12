// "How close was it": Tier 0 shape features plus Tier 1 DTW against this child's own templates.
// Additive only: the reward has already fired; this just pre-selects a rung chip the parent can change.
import { fbank, mfcc } from './fbank.ts'

export type Frames = ArrayLike<number>[]
export type Suggestion = 'sound' | 'close' | 'word'
export interface ClosenessFeatures {
  voicedS: number
  syllables: number
  onset: 'vowel' | 'consonant'
  distance: number | null // best DTW distance to a template, null without templates
}
export interface Closeness {
  suggestion: Suggestion
  confidence: number
  features: ClosenessFeatures
}

const SR = 16000
const HOP = 160 // 10 ms envelope
const SMOOTH = 5 // 50 ms moving average
const HIGH = 0.35 // of the loudest frame: a syllable nucleus
const LOW = 0.18 // a dip below this separates two syllables
const FLOOR_RMS = 0.002
const MIN_SYLLABLE_GAP = 8 // 80 ms: closer peaks are one syllable
const STOP_RISE_S = 0.03
const NASAL_LOW_RATIO = 0.75
const LOW_BINS = 12 // fbank bins under ~500 Hz
const MIN_PAST = 10
const WORD_PCT = 0.2
const CLOSE_PCT = 0.5

function envelope(samples: Float32Array): { raw: number[]; env: number[] } {
  const raw: number[] = []
  for (let at = 0; at + HOP <= samples.length; at += HOP) {
    let s = 0
    for (let i = at; i < at + HOP; i += 1) s += samples[i] * samples[i]
    raw.push(Math.sqrt(s / HOP))
  }
  const env = raw.map((_, i) => {
    const lo = Math.max(0, i - (SMOOTH >> 1))
    const hi = Math.min(raw.length, i + (SMOOTH >> 1) + 1)
    let s = 0
    for (let j = lo; j < hi; j += 1) s += raw[j]
    return s / (hi - lo)
  })
  return { raw, env }
}

/** Tier 0: voiced duration, syllable count (hysteresis on the energy envelope) and onset class. */
export function shape(samples: Float32Array): Omit<ClosenessFeatures, 'distance'> {
  const { raw, env } = envelope(samples)
  const peak = Math.max(0, ...env)
  if (peak < FLOOR_RMS) return { voicedS: 0, syllables: 0, onset: 'vowel' }
  const voicedS = (env.filter((e) => e > LOW * peak).length * HOP) / SR
  let syllables = 0
  let inside = false
  let lastEnd = -Infinity
  let firstStart = -1
  for (let i = 0; i < env.length; i += 1) {
    if (!inside && env[i] > HIGH * peak) {
      inside = true
      if (i - lastEnd >= MIN_SYLLABLE_GAP) syllables += 1
      if (firstStart < 0) firstStart = i
    } else if (inside && env[i] < LOW * peak) {
      inside = false
      lastEnd = i
    }
  }
  // Rise time of the first nucleus on the raw 10 ms envelope: smoothing would blur every burst.
  let from = firstStart
  while (from > 0 && raw[from - 1] > 0.1 * peak) from -= 1
  let to = from
  const top = Math.max(...raw.slice(from, Math.min(raw.length, from + 30)))
  while (to < raw.length - 1 && raw[to] < 0.9 * top) to += 1
  const riseS = ((to - from) * HOP) / SR
  const head = fbank(samples.subarray(from * HOP, Math.min(samples.length, (from + 5) * HOP + 400)))
  let low = 0
  let all = 0
  for (const f of head) f.forEach((v, m) => ((all += Math.exp(v)), m < LOW_BINS && (low += Math.exp(v))))
  const nasal = all > 0 && low / all > NASAL_LOW_RATIO
  return { voicedS, syllables, onset: riseS < STOP_RISE_S || nasal ? 'consonant' : 'vowel' }
}

/** Length-normalised DTW (Euclidean frame cost, Sakoe-Chiba band). Identical inputs give 0. */
export function dtw(a: Frames, b: Frames): number {
  const n = a.length
  const m = b.length
  if (!n || !m) return Infinity
  const band = Math.max(Math.abs(n - m), Math.ceil(0.25 * Math.max(n, m)))
  let prev = new Float64Array(m + 1).fill(Infinity)
  let cur = new Float64Array(m + 1)
  prev[0] = 0
  for (let i = 1; i <= n; i += 1) {
    cur.fill(Infinity)
    const centre = Math.round((i * m) / n)
    for (let j = Math.max(1, centre - band); j <= Math.min(m, centre + band); j += 1) {
      let d = 0
      const x = a[i - 1]
      const y = b[j - 1]
      for (let k = 0; k < Math.min(x.length, y.length); k += 1) d += (x[k] - y[k]) ** 2
      cur[j] = Math.sqrt(d) + Math.min(prev[j], cur[j - 1], prev[j - 1])
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[m] / (n + m)
}

/** Vowel groups in the written target, a rough syllable count ("bubbles" → 2, "more" → 1). */
export function syllablesOf(word: string): number {
  return word
    .toLowerCase()
    .split(/\s+/)
    .reduce((n, w) => n + Math.max(1, (w.replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length), 0)
}

export const templateFrames = (samples: Float32Array): number[][] =>
  mfcc(fbank(samples)).map((f) => Array.from(f, (v) => Math.round(v * 100) / 100))

export function closeness(
  samples: Float32Array,
  opts: { target: string; templates: Frames[]; pastDistances: number[] },
): Closeness {
  const s = shape(samples)
  const frames = mfcc(fbank(samples))
  const distance = opts.templates.length ? Math.min(...opts.templates.map((t) => dtw(frames, t))) : null
  const features = { ...s, distance }
  const want = syllablesOf(opts.target)
  const refS = opts.templates.length ? opts.templates[0].length / 100 : want * 0.3
  const shapeMatch = s.syllables === want && s.voicedS >= 0.5 * refS && s.voicedS <= 2 * refS
  const past = opts.pastDistances.filter(Number.isFinite)
  if (distance === null || past.length < MIN_PAST) {
    return { suggestion: shapeMatch ? 'close' : 'sound', confidence: 0.3, features }
  }
  const rank = past.filter((d) => d < distance).length / past.length
  if (rank <= WORD_PCT && s.syllables === want) return { suggestion: 'word', confidence: 1 - rank, features }
  if (rank <= CLOSE_PCT || shapeMatch) return { suggestion: 'close', confidence: 1 - rank, features }
  return { suggestion: 'sound', confidence: rank, features }
}

/** The voiced stretch of a recording (first to last frame above 10 % of the peak), for templates. */
export function voicedPart(samples: Float32Array): Float32Array {
  const { env } = envelope(samples)
  const peak = Math.max(0, ...env)
  if (peak < FLOOR_RMS) return samples.subarray(0, 0)
  const first = env.findIndex((e) => e > 0.1 * peak)
  const last = env.length - 1 - [...env].reverse().findIndex((e) => e > 0.1 * peak)
  return samples.subarray(first * HOP, (last + 1) * HOP)
}
