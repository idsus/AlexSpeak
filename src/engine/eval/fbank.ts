// Kaldi-compatible log-mel filterbank (what the speaker model was trained on) and MFCCs
// for template matching. Pure math so the browser and the Node harness agree exactly.
import { fft } from './energy.ts'

export const FBANK_BINS = 80
export const MFCC_DIMS = 13
const FRAME_LEN = 400 // 25 ms at 16 kHz
const FRAME_SHIFT = 160 // 10 ms
const N_FFT = 512
const PREEMPH = 0.97
const LOW_HZ = 20
const EPS = 1.1920928955078125e-7 // FLT_EPSILON, Kaldi's log floor

const mel = (hz: number) => 1127 * Math.log(1 + hz / 700)

const filterCache = new Map<number, Float64Array[]>()

/** Triangular filters in the mel domain, one weight per FFT bin (Kaldi's layout). */
function melFilters(sampleRate: number): Float64Array[] {
  const hit = filterCache.get(sampleRate)
  if (hit) return hit
  const lo = mel(LOW_HZ)
  const hi = mel(sampleRate / 2)
  const delta = (hi - lo) / (FBANK_BINS + 1)
  const filters: Float64Array[] = []
  for (let m = 0; m < FBANK_BINS; m += 1) {
    const left = lo + m * delta
    const centre = left + delta
    const right = centre + delta
    const w = new Float64Array(N_FFT / 2)
    for (let k = 0; k < N_FFT / 2; k += 1) {
      const x = mel((k * sampleRate) / N_FFT)
      if (x > left && x <= centre) w[k] = (x - left) / (centre - left)
      else if (x > centre && x < right) w[k] = (right - x) / (right - centre)
    }
    filters.push(w)
  }
  filterCache.set(sampleRate, filters)
  return filters
}

const povey = Float64Array.from({ length: FRAME_LEN }, (_, i) => (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_LEN - 1))) ** 0.85)

/** 80-dim log-mel frames, 25 ms window / 10 ms hop, no dither, snip edges. Samples are -1..1. */
export function fbank(samples: Float32Array, sampleRate = 16000): Float32Array[] {
  const filters = melFilters(sampleRate)
  const out: Float32Array[] = []
  const re = new Float64Array(N_FFT)
  const im = new Float64Array(N_FFT)
  const power = new Float64Array(N_FFT / 2)
  for (let at = 0; at + FRAME_LEN <= samples.length; at += FRAME_SHIFT) {
    let mean = 0
    for (let i = 0; i < FRAME_LEN; i += 1) mean += samples[at + i]
    mean /= FRAME_LEN
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < FRAME_LEN; i += 1) re[i] = samples[at + i] - mean
    for (let i = FRAME_LEN - 1; i > 0; i -= 1) re[i] -= PREEMPH * re[i - 1]
    re[0] -= PREEMPH * re[0]
    for (let i = 0; i < FRAME_LEN; i += 1) re[i] *= povey[i]
    fft(re, im)
    for (let k = 0; k < N_FFT / 2; k += 1) power[k] = re[k] * re[k] + im[k] * im[k]
    const frame = new Float32Array(FBANK_BINS)
    for (let m = 0; m < FBANK_BINS; m += 1) {
      let e = 0
      const w = filters[m]
      for (let k = 0; k < N_FFT / 2; k += 1) e += w[k] * power[k]
      frame[m] = Math.log(Math.max(e, EPS))
    }
    out.push(frame)
  }
  return out
}

/** Subtract the per-dimension mean over the utterance (cepstral/feature mean normalisation). */
export function meanNormalise(frames: Float32Array[]): Float32Array[] {
  if (!frames.length) return frames
  const dims = frames[0].length
  const mean = new Float64Array(dims)
  for (const f of frames) for (let d = 0; d < dims; d += 1) mean[d] += f[d]
  for (let d = 0; d < dims; d += 1) mean[d] /= frames.length
  return frames.map((f) => f.map((v, d) => v - mean[d]))
}

const dct = Array.from({ length: MFCC_DIMS }, (_, c) =>
  Float64Array.from({ length: FBANK_BINS }, (_, m) => Math.sqrt((c === 0 ? 1 : 2) / FBANK_BINS) * Math.cos((Math.PI * c * (m + 0.5)) / FBANK_BINS)),
)

/** 13 MFCCs per fbank frame (orthonormal DCT-II), mean-normalised so mic gain drops out. */
export function mfcc(frames: Float32Array[]): Float32Array[] {
  return meanNormalise(
    frames.map((f) => {
      const c = new Float32Array(MFCC_DIMS)
      for (let i = 0; i < MFCC_DIMS; i += 1) {
        let s = 0
        for (let m = 0; m < FBANK_BINS; m += 1) s += dct[i][m] * f[m]
        c[i] = s
      }
      return c
    }),
  )
}
