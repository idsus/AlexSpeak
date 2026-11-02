/// <reference types="node" />
// Replays fixtures/engine/*.wav through the real AttemptEngine and prints
// recall / false accepts per minute / latency per clip kind. Run: npm run engine:eval
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as ort from 'onnxruntime-web'
import { AttemptEngine, FRAME_SIZE, SAMPLE_RATE, type Attempt } from './engine.ts'
import { SileroVad } from './silero.ts'
import { readWav, resample } from './wav.ts'

interface Label {
  file: string
  kind: 'child' | 'parent' | 'tts' | 'noise' | 'silence'
  attempts?: number[]
}

const FIXTURES = join('fixtures', 'engine')
const MODEL = join('public', 'models', 'vad', 'silero_vad.onnx')
const MATCH_WINDOW_S = 1.0
// The app's "normal" mic preset (src/data/settings.ts).
const THRESHOLDS = { sensitivity: 32, noiseRejection: 45 }

async function replay(samples: Float32Array, vad: SileroVad | null): Promise<Attempt[]> {
  const engine = new AttemptEngine(THRESHOLDS)
  engine.resume()
  vad?.reset()
  const attempts: Attempt[] = []
  for (let at = 0; at + FRAME_SIZE <= samples.length; at += FRAME_SIZE) {
    const frame = samples.subarray(at, at + FRAME_SIZE)
    const hit = engine.push(frame, vad ? await vad.prob(frame) : undefined)
    if (hit) attempts.push(hit)
  }
  return attempts
}

/** Each labelled onset is caught by the first attempt within 1 s after it; every other attempt is a false accept. */
function score(onsets: number[], attempts: Attempt[]) {
  const used = new Set<Attempt>()
  const latencies: number[] = []
  for (const onset of onsets) {
    const hit = attempts.find((a) => !used.has(a) && a.t >= onset && a.t <= onset + MATCH_WINDOW_S)
    if (!hit) continue
    used.add(hit)
    latencies.push(hit.t - onset)
  }
  return { hits: latencies.length, latencies, falseAccepts: attempts.length - used.size }
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

async function main() {
  const labels: Label[] = JSON.parse(await readFile(join(FIXTURES, 'labels.json'), 'utf8'))
  let vad: SileroVad | null = null
  if (existsSync(MODEL)) {
    ort.env.wasm.numThreads = 1
    vad = await SileroVad.create(ort, new Uint8Array(await readFile(MODEL)))
    console.log(`VAD: Silero (${MODEL}) OR energy\n`)
  } else {
    console.log(`VAD: model not found at ${MODEL} (run npm run fetch-models) — energy-only\n`)
  }

  const byKind = new Map<string, { clips: number; onsets: number; hits: number; fa: number; seconds: number; lat: number[] }>()
  for (const label of labels) {
    const wav = readWav(new Uint8Array(await readFile(join(FIXTURES, label.file))))
    const samples = resample(wav.samples, wav.sampleRate, SAMPLE_RATE)
    const attempts = await replay(samples, vad)
    const onsets = label.attempts ?? []
    const s = score(onsets, attempts)
    const k = byKind.get(label.kind) ?? { clips: 0, onsets: 0, hits: 0, fa: 0, seconds: 0, lat: [] }
    k.clips += 1
    k.onsets += onsets.length
    k.hits += s.hits
    k.fa += s.falseAccepts
    k.seconds += samples.length / SAMPLE_RATE
    k.lat.push(...s.latencies)
    byKind.set(label.kind, k)
    const fired = attempts.map((a) => `${a.t.toFixed(2)}s/${a.channel}`).join(' ') || '-'
    console.log(`  ${label.file.padEnd(28)} ${label.kind.padEnd(8)} ${fired}`)
  }

  console.log('\nkind      clips  recall        FA/min  median latency')
  for (const [kind, k] of byKind) {
    const recall = k.onsets ? `${((100 * k.hits) / k.onsets).toFixed(0)}% (${k.hits}/${k.onsets})` : 'n/a'
    const fa = ((k.fa * 60) / k.seconds).toFixed(1)
    const lat = k.lat.length ? `${Math.round(median(k.lat) * 1000)} ms` : '-'
    console.log(`${kind.padEnd(9)} ${String(k.clips).padStart(5)}  ${recall.padEnd(12)} ${fa.padStart(7)}  ${lat}`)
  }
  await vad?.release()
}

await main()
