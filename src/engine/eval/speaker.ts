import type * as Ort from 'onnxruntime-web'
import { FBANK_BINS, fbank, meanNormalise } from './fbank.ts'
import { medianF0 } from './pitch.ts'

// Below this many 10 ms frames the model's pooling is unstable, so short clips are tiled.
const MIN_FRAMES = 30
// Pre-gate: a parent this low is clearly an adult man; a segment this low is not a child.
const LOW_PARENT_HZ = 160
const LOW_SEGMENT_HZ = 180

export interface VetoResult {
  parent: boolean
  score: number // best cosine similarity to an enrolled adult (1 when the pitch gate decided)
}
/** Decides whether a voiced segment is an enrolled adult. Never asks "is this the child". */
export type Veto = (segment: Float32Array) => Promise<VetoResult>
export type Embed = (samples: Float32Array) => Promise<Float32Array>

export function l2normalise(v: ArrayLike<number>): number[] {
  let n = 0
  for (let i = 0; i < v.length; i += 1) n += v[i] * v[i]
  n = Math.sqrt(n) || 1
  return Array.from(v, (x) => x / n)
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na * nb) || 1)
}

/** The stored prototype: mean of L2-normalised embeddings, normalised again. */
export function prototype(embeddings: ArrayLike<number>[]): number[] {
  const dims = embeddings[0]?.length ?? 0
  const sum = new Array<number>(dims).fill(0)
  for (const e of embeddings) l2normalise(e).forEach((x, i) => (sum[i] += x))
  return l2normalise(sum)
}

export function makeParentVeto(embed: Embed, voices: number[][], pitches: number[], threshold: number): Veto {
  const lowParent = pitches.some((p) => p > 0 && p < LOW_PARENT_HZ)
  return async (segment) => {
    if (lowParent) {
      const f0 = medianF0(segment)
      if (f0 !== null && f0 < LOW_SEGMENT_HZ) return { parent: true, score: 1 }
    }
    const e = await embed(segment)
    const score = Math.max(-1, ...voices.map((v) => cosine(e, v)))
    return { parent: score >= threshold, score }
  }
}

/**
 * Speaker embeddings (3D-Speaker CAM++, VoxCeleb) over onnxruntime-web. Like SileroVad the
 * ort module is injected: the browser passes `onnxruntime-web/wasm`, Node the package build.
 */
export class SpeakerEmbedder {
  private constructor(
    private readonly ort: typeof Ort,
    private readonly session: Ort.InferenceSession,
  ) {}

  static async create(ort: typeof Ort, model: Uint8Array): Promise<SpeakerEmbedder> {
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
    return new SpeakerEmbedder(ort, session)
  }

  /** L2-normalised embedding of a 16 kHz mono clip. */
  async embed(samples: Float32Array): Promise<Float32Array> {
    let frames = fbank(samples)
    if (!frames.length) throw new Error('segment too short to embed')
    while (frames.length < MIN_FRAMES) frames = frames.concat(frames)
    frames = meanNormalise(frames)
    const data = new Float32Array(frames.length * FBANK_BINS)
    frames.forEach((f, i) => data.set(f, i * FBANK_BINS))
    const input = this.session.inputNames[0]
    const out = await this.session.run({ [input]: new this.ort.Tensor('float32', data, [1, frames.length, FBANK_BINS]) })
    return Float32Array.from(l2normalise(out[this.session.outputNames[0]].data as Float32Array))
  }

  release(): Promise<void> {
    return this.session.release()
  }
}

const ENROL_WIN_S = 1.5
const ENROL_MIN_RMS = 0.003

/** A parent prototype from a few seconds of talking: voiced 1.5 s windows, embedded and averaged. */
export async function enrol(samples: Float32Array, embed: Embed, sampleRate = 16000): Promise<{ voice: number[]; pitch: number }> {
  const win = Math.round(ENROL_WIN_S * sampleRate)
  const windows: { x: Float32Array; rms: number }[] = []
  for (let at = 0; at + win <= Math.max(samples.length, win); at += win >> 1) {
    const x = samples.subarray(at, at + win)
    let s = 0
    for (const v of x) s += v * v
    windows.push({ x, rms: Math.sqrt(s / x.length) })
  }
  const loudest = Math.max(0, ...windows.map((w) => w.rms))
  const kept = windows.filter((w) => w.rms >= ENROL_MIN_RMS && w.rms >= 0.25 * loudest)
  if (!kept.length) throw new Error('no voice in the recording')
  const embeddings: Float32Array[] = []
  for (const w of kept) embeddings.push(await embed(w.x))
  const pitches = kept.map((w) => medianF0(w.x, sampleRate)).filter((p): p is number => p !== null).sort((a, b) => a - b)
  return { voice: prototype(embeddings), pitch: pitches[Math.floor(pitches.length / 2)] ?? 0 }
}
