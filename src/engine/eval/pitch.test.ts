import { describe, expect, it } from 'vitest'
import { medianF0 } from './pitch.ts'

const voice = (f0: number, seconds = 0.5) =>
  Float32Array.from({ length: Math.round(seconds * 16000) }, (_, i) => {
    let s = 0
    for (let h = 1; h <= 5; h += 1) s += Math.sin((2 * Math.PI * f0 * h * i) / 16000) / h
    return 0.2 * s
  })

describe('medianF0', () => {
  it.each([110, 160, 220, 270, 400])('finds %i Hz in a harmonic tone within 3 %%', (hz) => {
    expect(Math.abs(medianF0(voice(hz))! - hz) / hz).toBeLessThan(0.03)
  })

  it('is not fooled into the octave below by strong harmonics', () => {
    expect(medianF0(voice(260))!).toBeGreaterThan(240)
  })

  it('returns null for silence and white noise', () => {
    expect(medianF0(new Float32Array(8000))).toBeNull()
    let seed = 1
    const noise = Float32Array.from({ length: 8000 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4)
    expect(medianF0(noise)).toBeNull()
  })
})
