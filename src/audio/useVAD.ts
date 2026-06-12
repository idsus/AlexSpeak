import { MicVAD } from '@ricky0123/vad-web'
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
      onnxWASMBasePath: '/models/vad/',
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
