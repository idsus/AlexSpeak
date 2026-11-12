import { describe, expect, it } from 'vitest'
import { FBANK_BINS, MFCC_DIMS, fbank, mfcc } from './fbank.ts'

const tone = (hz: number, seconds: number, amp = 0.3) =>
  Float32Array.from({ length: Math.round(seconds * 16000) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / 16000))
const mel = (hz: number) => 1127 * Math.log(1 + hz / 700)

describe('fbank', () => {
  it('makes 25 ms / 10 ms frames of 80 finite log energies', () => {
    const frames = fbank(tone(440, 1))
    expect(frames).toHaveLength(1 + Math.floor((16000 - 400) / 160))
    expect(frames.every((f) => f.length === FBANK_BINS && f.every(Number.isFinite))).toBe(true)
    expect(fbank(new Float32Array(399))).toHaveLength(0)
  })

  it('puts a pure tone in the mel band that contains it', () => {
    for (const hz of [300, 1000, 3000]) {
      const f = fbank(tone(hz, 0.2))[5]
      const peak = f.indexOf(Math.max(...f))
      const delta = (mel(8000) - mel(20)) / (FBANK_BINS + 1)
      const centre = mel(20) + (peak + 1) * delta
      expect(Math.abs(centre - mel(hz))).toBeLessThan(1.5 * delta)
    }
  })

  it('shifts every band by 2·ln(gain) when the input is louder', () => {
    const a = fbank(tone(500, 0.1, 0.1))[3]
    const b = fbank(tone(500, 0.1, 0.4))[3]
    const peak = a.indexOf(Math.max(...a))
    expect(b[peak] - a[peak]).toBeCloseTo(2 * Math.log(4), 3)
  })

  it('gives 13 mean-normalised MFCCs that ignore mic gain', () => {
    const quiet = mfcc(fbank(tone(500, 0.3, 0.05)))
    const loud = mfcc(fbank(tone(500, 0.3, 0.5)))
    expect(quiet[0]).toHaveLength(MFCC_DIMS)
    for (let i = 0; i < quiet.length; i += 1) for (let d = 0; d < MFCC_DIMS; d += 1) expect(loud[i][d]).toBeCloseTo(quiet[i][d], 3)
  })
})
