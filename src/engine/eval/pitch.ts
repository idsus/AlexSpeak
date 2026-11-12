// Median F0 by normalised autocorrelation. Cheap enough to run on every segment; used only to
// spot a low adult voice (a father) before paying for the speaker model.

const WIN_S = 0.03
const HOP_S = 0.02
const MIN_HZ = 70
const MAX_HZ = 1000
const VOICED_R = 0.5 // normalised autocorrelation needed to call a window voiced

/** F0 of one window in Hz, or null when it isn't periodic enough. */
export function windowF0(x: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / MAX_HZ)
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), x.length - 1)
  let energy = 0
  for (const v of x) energy += v * v
  if (energy < 1e-8) return null
  const r = new Float64Array(maxLag + 1)
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let s = 0
    let e1 = 0
    let e2 = 0
    for (let i = 0; i + lag < x.length; i += 1) {
      s += x[i] * x[i + lag]
      e1 += x[i] * x[i]
      e2 += x[i + lag] * x[i + lag]
    }
    r[lag] = s / Math.sqrt(e1 * e2 + 1e-12)
    best = Math.max(best, r[lag])
  }
  if (best < VOICED_R) return null
  // The first peak close to the best one, so a sub-harmonic at 2x the lag never wins (octave error).
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (r[lag] >= 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      const a = r[lag - 1]
      const b = r[lag]
      const c = r[lag + 1]
      const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
      return sampleRate / (lag + shift)
    }
  }
  return null
}

/** Median F0 over the voiced windows of a segment, or null if under a few voiced windows. */
export function medianF0(samples: Float32Array, sampleRate = 16000): number | null {
  const win = Math.round(WIN_S * sampleRate)
  const hop = Math.round(HOP_S * sampleRate)
  const f0s: number[] = []
  for (let at = 0; at + win <= samples.length; at += hop) {
    const f = windowF0(samples.subarray(at, at + win), sampleRate)
    if (f !== null) f0s.push(f)
  }
  if (f0s.length < 3) return null
  f0s.sort((a, b) => a - b)
  return f0s[Math.floor(f0s.length / 2)]
}
