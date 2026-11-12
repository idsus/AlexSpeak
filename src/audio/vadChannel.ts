import { AttemptEngine, FRAME_SIZE, SAMPLE_RATE, type Outcome, type Segment } from '../engine/eval/engine'
import type { EnergyScore, VoiceProfile } from '../engine/eval/energy'
import type { SileroVad } from '../engine/eval/silero'
import { makeParentVeto } from '../engine/eval/speaker'
import { loadSpeaker } from './speakerModel'
import { getMicStream } from './useMic'

/** Enrolled adults whose voices are subtracted (never rewarded). Empty = Phase A behaviour. */
export interface ParentConfig {
  voices: number[][]
  pitches: number[]
  threshold: number
}

export interface MicChannelOptions {
  /** Effort score threshold, 0..100. Lower = more sensitive. */
  sensitivity: number
  noiseRejection: number
  voiceProfile: VoiceProfile
  onAttempt: () => void
  onScore?: (score: EnergyScore) => void
  onSegment?: (segment: Segment) => void
  parent?: ParentConfig
}

const MODEL_DIR = `${import.meta.env.BASE_URL}models/vad/`
const SCORE_EVERY_S = 0.09
// If inference falls this many frames behind, skip VAD for a frame rather than let latency grow.
const MAX_PENDING = 4

// Resamples the mic to 16 kHz (linear; fine for VAD and energy) and posts 512-sample frames.
const WORKLET = `
class Frames extends AudioWorkletProcessor {
  constructor() { super(); this.step = sampleRate / ${SAMPLE_RATE}; this.pos = 0; this.prev = 0; this.buf = new Float32Array(${FRAME_SIZE}); this.n = 0 }
  process(inputs) {
    const x = inputs[0] && inputs[0][0]
    if (!x || !x.length) return true
    while (this.pos < x.length) {
      const i = Math.floor(this.pos)
      const a = i === 0 ? this.prev : x[i - 1]
      this.buf[this.n++] = a + (x[i] - a) * (this.pos - i)
      if (this.n === ${FRAME_SIZE}) { this.port.postMessage(this.buf.slice()); this.n = 0 }
      this.pos += this.step
    }
    this.pos -= x.length
    this.prev = x[x.length - 1]
    return true
  }
}
registerProcessor('alexspeak-frames', Frames)
`

let warnedNoVad = false
let warnedNoSpeaker = false

async function loadVad(): Promise<SileroVad> {
  const [ort, { SileroVad }] = await Promise.all([import('onnxruntime-web/wasm'), import('../engine/eval/silero')])
  ort.env.wasm.numThreads = 1 // no SharedArrayBuffer / cross-origin isolation needed
  // Only the binary comes from public/; the JS glue is already inside onnxruntime-web/wasm.
  ort.env.wasm.wasmPaths = { wasm: `${MODEL_DIR}ort-wasm-simd-threaded.wasm` }
  const res = await fetch(`${MODEL_DIR}silero_vad.onnx`)
  if (!res.ok) throw new Error(`silero_vad.onnx: HTTP ${res.status}`)
  return SileroVad.create(ort, new Uint8Array(await res.arrayBuffer()))
}

async function openContext(stream: MediaStream): Promise<[AudioContext, MediaStreamAudioSourceNode]> {
  const Ctor = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctor({ sampleRate: SAMPLE_RATE })
  try {
    return [ctx, ctx.createMediaStreamSource(stream)]
  } catch {
    // Firefox refuses a mic source in a context at a different rate; resample in the worklet instead.
    await ctx.close()
    const native = new Ctor()
    return [native, native.createMediaStreamSource(stream)]
  }
}

/** Mic → 16 kHz 512-sample frames, plus resume/stop that release everything. */
async function openFrames(onFrame: (frame: Float32Array) => void): Promise<{ stop: () => Promise<void>; resume: () => Promise<void> }> {
  const stream = await getMicStream()
  const [ctx, source] = await openContext(stream)
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
    await ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
    const frames = new AudioWorkletNode(ctx, 'alexspeak-frames')
    // A silent path to the destination keeps the worklet pulled on every browser.
    const mute = ctx.createGain()
    mute.gain.value = 0
    source.connect(frames).connect(mute).connect(ctx.destination)
    frames.port.onmessage = (e: MessageEvent<Float32Array>) => onFrame(e.data)
    return {
      resume: async () => {
        if (ctx.state === 'suspended') await ctx.resume()
      },
      stop: async () => {
        ;[source, frames, mute].forEach((n) => n.disconnect())
        stream.getTracks().forEach((t) => t.stop())
        await ctx.close().catch(() => {})
      },
    }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop())
    await ctx.close().catch(() => {})
    throw err
  }
}

/** Records a fixed-length 16 kHz clip (enrolment, "record this word"); ends early if aborted. */
export async function recordClip(seconds: number, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<Float32Array> {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  let n = 0
  let done: () => void = () => {}
  const finished = new Promise<void>((resolve) => (done = resolve))
  const mic = await openFrames((frame) => {
    if (n >= out.length) return
    out.set(frame.subarray(0, out.length - n), n)
    n = Math.min(out.length, n + frame.length)
    onProgress?.(n / out.length)
    if (n >= out.length) done()
  })
  signal?.addEventListener('abort', () => done())
  if (signal?.aborted) done()
  await mic.resume()
  await finished
  await mic.stop()
  return out.subarray(0, n)
}

/**
 * The live mic: worklet frames → AttemptEngine, with Silero VAD OR-ed in once it
 * loads. Without the model it keeps working on the energy detector alone.
 */
export class VadChannel {
  private vad: SileroVad | null = null
  private queue: Promise<void> = Promise.resolve()
  private pending = 0
  private lastScoreAt = -Infinity
  private destroyed = false
  private readonly engine: AttemptEngine

  private mic: { stop: () => Promise<void>; resume: () => Promise<void> } | null = null
  private parentGen = 0

  private constructor(private readonly opts: MicChannelOptions) {
    this.engine = new AttemptEngine({ ...opts, onSegment: (s) => this.opts.onSegment?.(s) })
  }

  static async create(opts: MicChannelOptions): Promise<VadChannel> {
    const channel = new VadChannel(opts)
    channel.mic = await openFrames((frame) => channel.enqueue(frame))
    loadVad().then(
      (vad) => (channel.destroyed ? void vad.release() : (channel.vad = vad)),
      (err) => {
        if (!warnedNoVad) console.warn('Silero VAD unavailable; using the energy detector alone.', err)
        warnedNoVad = true
      },
    )
    if (opts.parent) channel.setParent(opts.parent)
    return channel
  }

  /** Without an enrolled adult (or without the model) the engine fires at once, as in Phase A. */
  setParent(p: ParentConfig): void {
    const gen = ++this.parentGen
    if (!p.voices.length) return this.engine.setVeto(null)
    loadSpeaker().then(
      (speaker) => {
        if (gen !== this.parentGen || this.destroyed) return
        // Inference joins the frame queue so the VAD and speaker sessions never run at once.
        const embed = (x: Float32Array) => {
          const done = this.queue.then(() => speaker.embed(x))
          this.queue = done.then(() => {}, () => {})
          return done
        }
        this.engine.setVeto(makeParentVeto(embed, p.voices, p.pitches, p.threshold))
      },
      (err) => {
        if (!warnedNoSpeaker) console.warn('Speaker model unavailable; every voice counts as before.', err)
        warnedNoSpeaker = true
      },
    )
  }

  setBoost(on: boolean): void {
    this.engine.setBoost(on)
  }

  setSensitivity(n: number): void {
    this.engine.setSensitivity(n)
  }

  setNoiseRejection(n: number): void {
    this.engine.setNoiseRejection(n)
  }

  async resume(): Promise<void> {
    this.engine.resume()
    await this.mic?.resume()
  }

  /** Pause attempt firing while the app itself is speaking. */
  async pause(): Promise<void> {
    this.engine.pause()
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    await this.mic?.stop()
    await this.queue
    await this.vad?.release().catch(() => {})
    this.vad = null
  }

  // Frames are processed strictly in order: the engine's clock is the sample count.
  private enqueue(frame: Float32Array): void {
    this.pending += 1
    this.queue = this.queue
      .then(() => this.process(frame))
      .catch((err) => console.error(err))
      .finally(() => (this.pending -= 1))
  }

  private async process(frame: Float32Array): Promise<void> {
    if (this.destroyed) return
    let prob: number | undefined
    if (this.vad && this.pending <= MAX_PENDING) {
      prob = await this.vad.prob(frame).catch((err) => {
        console.warn('Silero VAD failed; using the energy detector alone.', err)
        this.vad = null
        return undefined
      })
    }
    if (this.destroyed) return
    const out = this.engine.push(frame, prob)
    // A plain outcome fires synchronously (Phase A latency); a promise is the parent check settling.
    if (out instanceof Promise) void out.then((o) => this.report(o))
    else if (out) this.report(out)
    if (this.engine.t - this.lastScoreAt >= SCORE_EVERY_S) {
      this.lastScoreAt = this.engine.t
      this.opts.onScore?.(this.engine.lastScore)
    }
  }

  private report(o: Outcome): void {
    if (o.kind === 'attempt' && !this.destroyed) this.opts.onAttempt()
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
