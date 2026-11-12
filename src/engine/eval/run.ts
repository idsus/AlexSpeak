/// <reference types="node" />
// Replays fixtures/engine/*.wav through the real AttemptEngine and prints
// recall / false accepts per minute / latency per clip kind. Run: npm run engine:eval
// With `-- --parent <wav>` it also enrols a parent prototype from that clip and replays again
// with the known-adult veto on, so parent false accepts can be compared.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as ort from 'onnxruntime-web'
import { AttemptEngine, FRAME_SIZE, SAMPLE_RATE, type Attempt, type Outcome } from './engine.ts'
import { SileroVad } from './silero.ts'
import { SpeakerEmbedder, enrol, makeParentVeto, type Veto } from './speaker.ts'
import { readWav, resample } from './wav.ts'

interface Label {
  file: string
  kind: 'child' | 'parent' | 'tts' | 'noise' | 'silence'
  attempts?: number[]
}

const FIXTURES = join('fixtures', 'engine')
const MODEL = join('public', 'models', 'vad', 'silero_vad.onnx')
const SPEAKER_MODEL = join('public', 'models', 'speaker', 'campplus_en_voxceleb.onnx')
const MATCH_WINDOW_S = 1.0
// The app's "normal" mic preset (src/data/settings.ts).
const THRESHOLDS = { sensitivity: 32, noiseRejection: 45 }
const PARENT_THRESHOLD = 0.45 // the app's starting value (src/data/settings.ts)

async function replay(samples: Float32Array, vad: SileroVad | null, veto: Veto | null): Promise<Outcome[]> {
  const engine = new AttemptEngine({ ...THRESHOLDS, veto })
  engine.resume()
  vad?.reset()
  const outcomes: Outcome[] = []
  for (let at = 0; at + FRAME_SIZE <= samples.length; at += FRAME_SIZE) {
    const frame = samples.subarray(at, at + FRAME_SIZE)
    const hit = await engine.push(frame, vad ? await vad.prob(frame) : undefined)
    if (hit) outcomes.push(hit)
  }
  return outcomes
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

async function loadWav(path: string): Promise<Float32Array> {
  const wav = readWav(new Uint8Array(await readFile(path)))
  return resample(wav.samples, wav.sampleRate, SAMPLE_RATE)
}

async function parentVeto(file: string): Promise<{ veto: Veto; release: () => Promise<void> }> {
  if (!existsSync(SPEAKER_MODEL)) throw new Error(`--parent needs ${SPEAKER_MODEL} (node tools/fetch_speaker.mjs)`)
  const embedder = await SpeakerEmbedder.create(ort, new Uint8Array(await readFile(SPEAKER_MODEL)))
  let calls = 0
  let ms = 0
  const embed = async (x: Float32Array) => {
    const t0 = performance.now()
    const e = await embedder.embed(x)
    ms += performance.now() - t0
    calls += 1
    return e
  }
  const { voice, pitch } = await enrol(await loadWav(file), embed)
  console.log(`\nParent enrolled from ${file}: ${calls} windows, ${Math.round(ms / calls)} ms per 1.5 s embedding, median F0 ${Math.round(pitch)} Hz, threshold ${PARENT_THRESHOLD}`)
  return { veto: makeParentVeto(embed, [voice], [pitch], PARENT_THRESHOLD), release: () => embedder.release() }
}

async function table(labels: Label[], vad: SileroVad | null, veto: Veto | null, title: string) {
  console.log(`\n[${title}]`)
  const byKind = new Map<string, { clips: number; onsets: number; hits: number; fa: number; seconds: number; lat: number[] }>()
  for (const label of labels) {
    const samples = await loadWav(join(FIXTURES, label.file))
    const outcomes = await replay(samples, vad, veto)
    const attempts = outcomes.filter((o): o is Attempt => o.kind === 'attempt')
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
    const fired = outcomes.map((o) => `${o.t.toFixed(2)}s/${o.kind === 'parent' ? 'VETOED' : o.channel}${o.parentScore === undefined ? '' : ` cos=${o.parentScore.toFixed(2)}`}`).join(' ') || '-'
    console.log(`  ${label.file.padEnd(28)} ${label.kind.padEnd(8)} ${fired}`)
  }

  console.log('\nkind      clips  recall        FA/min  median latency')
  for (const [kind, k] of byKind) {
    const recall = k.onsets ? `${((100 * k.hits) / k.onsets).toFixed(0)}% (${k.hits}/${k.onsets})` : 'n/a'
    const fa = ((k.fa * 60) / k.seconds).toFixed(1)
    const lat = k.lat.length ? `${Math.round(median(k.lat) * 1000)} ms` : '-'
    console.log(`${kind.padEnd(9)} ${String(k.clips).padStart(5)}  ${recall.padEnd(12)} ${fa.padStart(7)}  ${lat}`)
  }
}

async function main() {
  const labels: Label[] = JSON.parse(await readFile(join(FIXTURES, 'labels.json'), 'utf8'))
  const at = process.argv.indexOf('--parent')
  const parentFile = at > 0 ? process.argv[at + 1] : undefined
  let vad: SileroVad | null = null
  ort.env.wasm.numThreads = 1
  if (existsSync(MODEL)) {
    vad = await SileroVad.create(ort, new Uint8Array(await readFile(MODEL)))
    console.log(`VAD: Silero (${MODEL}) OR energy`)
  } else {
    console.log(`VAD: model not found at ${MODEL} (run npm run fetch-models) — energy-only`)
  }
  await table(labels, vad, null, 'veto off')
  if (parentFile) {
    const parent = await parentVeto(parentFile)
    await table(labels, vad, parent.veto, 'veto on')
    await parent.release()
  }
  await vad?.release()
}

await main()
