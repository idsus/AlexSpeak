import type * as Ort from 'onnxruntime-web'
import { FRAME_SIZE, SAMPLE_RATE } from './engine.ts'

// v5+ models expect the last 64 samples of the previous chunk prepended to each 512-sample frame.
const CONTEXT = 64

/**
 * Silero VAD v5/v6 over onnxruntime-web. The ort module is passed in because the
 * browser loads `onnxruntime-web/wasm` and Node loads the package's Node build.
 */
export class SileroVad {
  private state: Float32Array = new Float32Array(2 * 128)
  private context = new Float32Array(CONTEXT)
  private readonly sr: Ort.Tensor
  private readonly input = new Float32Array(CONTEXT + FRAME_SIZE)

  private constructor(
    private readonly ort: typeof Ort,
    private readonly session: Ort.InferenceSession,
  ) {
    this.sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]), [])
  }

  static async create(ort: typeof Ort, model: Uint8Array): Promise<SileroVad> {
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
    return new SileroVad(ort, session)
  }

  /** Speech probability for one 512-sample 16 kHz frame. Frames must be fed in order. */
  async prob(frame: Float32Array): Promise<number> {
    this.input.set(this.context)
    this.input.set(frame, CONTEXT)
    const out = await this.session.run({
      input: new this.ort.Tensor('float32', this.input.slice(), [1, this.input.length]),
      state: new this.ort.Tensor('float32', this.state, [2, 1, 128]),
      sr: this.sr,
    })
    this.state = out.stateN.data as Float32Array
    this.context = this.input.slice(-CONTEXT)
    return (out.output.data as Float32Array)[0]
  }

  reset(): void {
    this.state = new Float32Array(2 * 128)
    this.context = new Float32Array(CONTEXT)
  }

  release(): Promise<void> {
    return this.session.release()
  }
}
