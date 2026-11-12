import { describe, expect, it } from 'vitest'
import { closeness, dtw, shape, syllablesOf, templateFrames, voicedPart } from './closeness.ts'

const SR = 16000
/** Harmonic bursts ("ba ba ba") with soft attacks, separated by quiet gaps. */
function bursts(n: number, burstS = 0.18, gapS = 0.12, f0 = 260, attackS = 0.06): Float32Array {
  const out = new Float32Array(Math.round((0.1 + n * (burstS + gapS)) * SR))
  for (let b = 0; b < n; b += 1) {
    const start = Math.round((0.1 + b * (burstS + gapS)) * SR)
    for (let i = 0; i < burstS * SR; i += 1) {
      const t = i / SR
      const env = Math.min(1, t / attackS, (burstS - t) / 0.03)
      let s = 0
      for (let h = 1; h <= 4; h += 1) s += Math.sin(2 * Math.PI * f0 * h * t) / h
      out[start + i] = 0.2 * env * s
    }
  }
  return out
}
/** A glide from f1 to f2 Hz over `seconds`. */
function glide(f1: number, f2: number, seconds: number): Float32Array {
  let phase = 0
  return Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => {
    phase += (2 * Math.PI * (f1 + ((f2 - f1) * i) / (seconds * SR))) / SR
    return 0.3 * Math.sin(phase)
  })
}

describe('shape (Tier 0)', () => {
  it.each([1, 2, 3])('counts %i syllable(s) in a %i-burst clip', (n) => {
    expect(shape(bursts(n)).syllables).toBe(n)
  })

  it('measures voiced duration and calls a soft attack vowel-like, a sharp one consonant-like', () => {
    const soft = shape(bursts(1, 0.3, 0.1, 260, 0.08))
    expect(soft.voicedS).toBeGreaterThan(0.25)
    expect(soft.voicedS).toBeLessThan(0.4)
    expect(soft.onset).toBe('vowel')
    expect(shape(bursts(1, 0.3, 0.1, 260, 0.003)).onset).toBe('consonant')
  })

  it('reports nothing for silence', () => {
    expect(shape(new Float32Array(8000))).toEqual({ voicedS: 0, syllables: 0, onset: 'vowel' })
  })
})

describe('dtw (Tier 1)', () => {
  it('is 0 for identical patterns', () => {
    const a = templateFrames(glide(300, 900, 0.5))
    expect(dtw(a, a)).toBe(0)
  })

  it('puts a time-stretched copy closer than a different pattern', () => {
    const a = templateFrames(glide(300, 900, 0.5))
    const stretched = templateFrames(glide(300, 900, 0.75))
    const other = templateFrames(glide(900, 300, 0.5))
    expect(dtw(a, stretched)).toBeLessThan(dtw(a, other))
  })
})

describe('closeness', () => {
  it('counts syllables in the written target', () => {
    expect(['ba', 'more', 'bubbles', 'uh oh'].map(syllablesOf)).toEqual([1, 1, 2, 2])
  })

  it('falls back to the shape rule with few past distances, and never says "word"', () => {
    const two = bursts(2)
    expect(closeness(two, { target: 'bubbles', templates: [], pastDistances: [] }).suggestion).toBe('close')
    expect(closeness(bursts(3), { target: 'bubbles', templates: [], pastDistances: [] }).suggestion).toBe('sound')
    const self = templateFrames(two)
    expect(closeness(two, { target: 'bubbles', templates: [self], pastDistances: [1, 2, 3] }).suggestion).toBe('close')
  })

  it('says "word" only for a template match in the best 20 % of this child\'s past distances', () => {
    const two = bursts(2)
    const past = Array.from({ length: 20 }, (_, i) => 1 + i)
    const near = closeness(two, { target: 'bubbles', templates: [templateFrames(two)], pastDistances: past })
    expect(near.suggestion).toBe('word')
    expect(near.features.distance).toBeLessThan(0.05) // templates are rounded to 0.01
    const far = closeness(two, { target: 'bubbles', templates: [templateFrames(glide(900, 300, 0.5))], pastDistances: past.map((d) => d / 1000) })
    expect(far.suggestion).not.toBe('word')
  })
})

describe('voicedPart', () => {
  it('trims the quiet before and after a word', () => {
    const x = new Float32Array(16000)
    x.set(bursts(1).subarray(1600, 1600 + 2880), 6000)
    const v = voicedPart(x)
    expect(v.length).toBeGreaterThan(2000)
    expect(v.length).toBeLessThan(4000)
    expect(voicedPart(new Float32Array(1000)).length).toBe(0)
  })
})
