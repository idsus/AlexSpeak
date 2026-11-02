import { describe, expect, it } from 'vitest'
import { readWav, resample, writeWav } from './wav.ts'

describe('wav io', () => {
  it('round-trips 16-bit mono PCM', () => {
    const samples = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.8)
    const back = readWav(writeWav({ sampleRate: 22050, samples }))
    expect(back.sampleRate).toBe(22050)
    expect(back.samples.length).toBe(samples.length)
    back.samples.forEach((s, i) => expect(Math.abs(s - samples[i])).toBeLessThan(1e-4))
  })

  it('resamples by linear interpolation', () => {
    expect(Array.from(resample(Float32Array.from([0, 1, 0, -1]), 32000, 16000))).toEqual([0, 0])
    expect(Array.from(resample(Float32Array.from([0, 1]), 8000, 16000))).toEqual([0, 0.5, 1, 1])
  })
})
