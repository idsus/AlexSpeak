// Writes the synthetic engine fixtures + labels.json. Deterministic (seeded),
// no network. These prove the plumbing only; real recall needs real clips.
// Usage: node tools/make_fixtures.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 16000
const SECONDS = 5
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'engine')

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dbfs = (db) => 10 ** (db / 20) // RMS amplitude for a level in dBFS
const rmsOf = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
const scaleTo = (x, db) => {
  const k = dbfs(db) / rmsOf(x)
  return x.map((v) => v * k)
}

function white(db, seed) {
  const r = rng(seed)
  return scaleTo(Float32Array.from({ length: SR * SECONDS }, () => r() * 2 - 1), db)
}

// Paul Kellet's economy pink filter: close enough to 1/f for a room-noise proxy.
function pink(db, seed) {
  const r = rng(seed)
  let b0 = 0, b1 = 0, b2 = 0
  return scaleTo(
    Float32Array.from({ length: SR * SECONDS }, () => {
      const w = r() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      return b0 + b1 + b2 + w * 0.1848
    }),
    db,
  )
}

/** 300 ms harmonic complex (6 harmonics, 1/n amplitude, 20 ms fades) at each onset, over a noise bed. */
function voiced(f0, db, onsets, seed) {
  const x = white(-50, seed)
  const len = Math.round(0.3 * SR)
  const fade = Math.round(0.02 * SR)
  const tone = Float32Array.from({ length: len }, (_, i) => {
    let v = 0
    for (let n = 1; n <= 6; n += 1) v += Math.sin((2 * Math.PI * f0 * n * i) / SR) / n
    return v * Math.min(1, i / fade, (len - 1 - i) / fade)
  })
  const k = dbfs(db) / rmsOf(tone.subarray(fade, len - fade))
  for (const s of onsets) tone.forEach((v, i) => (x[Math.round(s * SR) + i] += v * k))
  return x
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2))
  return buf
}

const onsets = [1.0, 3.0]
const clips = [
  { file: 'silence.wav', kind: 'silence', samples: new Float32Array(SR * SECONDS) },
  { file: 'white-30.wav', kind: 'noise', samples: white(-30, 1) },
  { file: 'pink-30.wav', kind: 'noise', samples: pink(-30, 2) },
  { file: 'child-harmonic-20.wav', kind: 'child', samples: voiced(260, -20, onsets, 3), attempts: onsets },
  { file: 'child-harmonic-30.wav', kind: 'child', samples: voiced(260, -30, onsets, 4), attempts: onsets },
  { file: 'child-harmonic-40.wav', kind: 'child', samples: voiced(260, -40, onsets, 5), attempts: onsets },
  { file: 'parent-harmonic-30.wav', kind: 'parent', samples: voiced(120, -30, onsets, 6) },
]

await mkdir(out, { recursive: true })
for (const c of clips) await writeFile(join(out, c.file), wav(c.samples))
const labels = clips.map(({ file, kind, attempts }) => (attempts ? { file, kind, attempts } : { file, kind }))
await writeFile(join(out, 'labels.json'), JSON.stringify(labels, null, 2) + '\n')
console.log(`wrote ${clips.length} clips to ${out}`)
