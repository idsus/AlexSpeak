// Minimal 16-bit PCM WAV io for the replay harness and fixture generator.

export interface Wav {
  sampleRate: number
  samples: Float32Array // mono, -1..1
}

export function readWav(bytes: Uint8Array): Wav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file')
  let channels = 0
  let sampleRate = 0
  let bits = 0
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (id === 'fmt ') {
      const format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      // 0xfffe is WAVE_FORMAT_EXTENSIBLE, which is still plain PCM for 16-bit files.
      if ((format !== 1 && format !== 0xfffe) || bits !== 16) throw new Error('only 16-bit PCM WAV is supported')
    } else if (id === 'data') {
      if (!channels) throw new Error('data chunk before fmt chunk')
      const frames = Math.floor(Math.min(size, bytes.length - body) / (2 * channels))
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i += 1) {
        let sum = 0
        for (let c = 0; c < channels; c += 1) sum += view.getInt16(body + (i * channels + c) * 2, true)
        samples[i] = sum / channels / 32768
      }
      return { sampleRate, samples }
    }
    at = body + size + (size & 1)
  }
  throw new Error('no data chunk')
}

export function writeWav({ sampleRate, samples }: Wav): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const put = (at: number, s: string) => [...s].forEach((ch, i) => (bytes[at + i] = ch.charCodeAt(0)))
  put(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  put(8, 'WAVE')
  put(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  put(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true))
  return bytes
}

/** Linear-interpolation resample; fine for VAD/energy, not for listening. */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const out = new Float32Array(Math.floor((samples.length * to) / from))
  const step = from / to
  for (let i = 0; i < out.length; i += 1) {
    const x = i * step
    const j = Math.floor(x)
    const a = samples[j] ?? 0
    const b = samples[j + 1] ?? a
    out[i] = a + (b - a) * (x - j)
  }
  return out
}
