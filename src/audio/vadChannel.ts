import { AttemptEngine, FRAME_SIZE, SAMPLE_RATE } from '../engine/eval/engine'
import type { EnergyScore, VoiceProfile } from '../engine/eval/energy'
import type { SileroVad } from '../engine/eval/silero'
import { getMicStream } from './useMic'

export interface MicChannelOptions {
  /** Effort score threshold, 0..100. Lower = more sensitive. */
  sensitivity: number
  noiseRejection: number
  voiceProfile: VoiceProfile
  onAttempt: () => void
  onScore?: (score: EnergyScore) => void
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

  private constructor(
    private readonly stream: MediaStream,
    private readonly ctx: AudioContext,
    private readonly nodes: AudioNode[],
    private readonly opts: MicChannelOptions,
  ) {
    this.engine = new AttemptEngine(opts)
  }

  static async create(opts: MicChannelOptions): Promise<VadChannel> {
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
      const channel = new VadChannel(stream, ctx, [source, frames, mute], opts)
      frames.port.onmessage = (e: MessageEvent<Float32Array>) => channel.enqueue(e.data)
      loadVad().then(
        (vad) => (channel.destroyed ? void vad.release() : (channel.vad = vad)),
        (err) => {
          if (!warnedNoVad) console.warn('Silero VAD unavailable; using the energy detector alone.', err)
          warnedNoVad = true
        },
      )
      return channel
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      await ctx.close().catch(() => {})
      throw err
    }
  }

  setSensitivity(n: number): void {
    this.engine.setSensitivity(n)
  }

  setNoiseRejection(n: number): void {
    this.engine.setNoiseRejection(n)
  }

  async resume(): Promise<void> {
    this.engine.resume()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  /** Pause attempt firing while the app itself is speaking. */
  async pause(): Promise<void> {
    this.engine.pause()
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.nodes.forEach((n) => n.disconnect())
    this.stream.getTracks().forEach((t) => t.stop())
    await this.ctx.close().catch(() => {})
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
    if (this.engine.push(frame, prob)) this.opts.onAttempt()
    if (this.engine.t - this.lastScoreAt >= SCORE_EVERY_S) {
      this.lastScoreAt = this.engine.t
      this.opts.onScore?.(this.engine.lastScore)
    }
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
