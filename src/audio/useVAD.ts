import { MicVAD } from '@ricky0123/vad-web'
// ORT's wasm loader must come through Vite's asset pipeline (?url), not from
// public/ — onnxruntime-web loads it with a dynamic import(), and Vite's dev
// server refuses JS imports of public-directory files (500).
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import { getMicStream } from './useMic'

// Silero VAD wrapper, tuned hot: the cost of missing a real attempt
// (discouraging) far outweighs a false positive (a free celebration).
// onSpeechStart is used as the attempt signal — we do not wait for a full
// validated speech segment, the first positive frames are enough.

export interface VadChannelOptions {
  /** positiveSpeechThreshold, 0..1 — lower = more sensitive */
  sensitivity: number
  onAttempt: () => void
}

export class VadChannel {
  private constructor(private vad: MicVAD) {}

  static async create(options: VadChannelOptions): Promise<VadChannel> {
    const vad = await MicVAD.new({
      model: 'v5',
      baseAssetPath: '/models/vad/',
      // Runs after MicVAD applies onnxWASMBasePath, so this wins. The object
      // form points ORT at the exact loader/wasm assets bundled by Vite.
      ortConfig: (ort) => {
        ort.env.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl }
      },
      getStream: getMicStream,
      startOnLoad: false,
      positiveSpeechThreshold: options.sensitivity,
      negativeSpeechThreshold: Math.max(options.sensitivity - 0.15, 0.05),
      minSpeechMs: 64, // ~2 frames — quiet, brief sounds still count
      redemptionMs: 300,
      submitUserSpeechOnPause: false,
      onSpeechStart: options.onAttempt,
    })
    return new VadChannel(vad)
  }

  setSensitivity(sensitivity: number): void {
    this.vad.setOptions({
      positiveSpeechThreshold: sensitivity,
      negativeSpeechThreshold: Math.max(sensitivity - 0.15, 0.05),
    })
  }

  /** Resume listening (call when a listen window opens). */
  async resume(): Promise<void> {
    await this.vad.start()
  }

  /** Pause while the app itself is speaking so the mic never hears the app. */
  async pause(): Promise<void> {
    await this.vad.pause()
  }

  async destroy(): Promise<void> {
    await this.vad.destroy()
  }
}
