// Puts the Silero VAD model and onnxruntime-web's single-thread WASM in
// public/models/vad/ so the app serves (and precaches) them itself — never a CDN.
// Usage: npm run fetch-models
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'models', 'vad')
const TAG = 'v6.2' // Silero VAD v6 model
const MODEL_URL = `https://raw.githubusercontent.com/snakers4/silero-vad/${TAG}/src/silero_vad/data/silero_vad.onnx`
// onnxruntime-web/wasm embeds the JS glue, so only the plain SIMD binary is fetched at runtime.
const ORT_FILES = ['ort-wasm-simd-threaded.wasm']

const exists = (p) => stat(p).then((s) => s.size > 0, () => false)

await mkdir(out, { recursive: true })

const modelPath = join(out, 'silero_vad.onnx')
if (await exists(modelPath)) {
  console.log('silero_vad.onnx already present')
} else {
  console.log(`downloading ${MODEL_URL}`)
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length < 1_000_000) throw new Error(`model looks truncated (${bytes.length} bytes)`)
  await writeFile(modelPath, bytes)
}

for (const name of ORT_FILES) {
  await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', name), join(out, name))
}

for (const name of ['silero_vad.onnx', ...ORT_FILES]) {
  console.log(`${name}: ${((await stat(join(out, name))).size / 1e6).toFixed(2)} MB`)
}
