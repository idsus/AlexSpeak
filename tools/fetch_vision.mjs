// Puts MediaPipe's Face Landmarker model and its SIMD WASM in public/models/vision/
// so the app serves (and precaches) them itself — never a CDN.
// Usage: npm run fetch-models
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'models', 'vision')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
// useAttention points FaceLandmarker straight at these two; the nosimd/module builds are not shipped.
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']

const exists = (p) => stat(p).then((s) => s.size > 0, () => false)

await mkdir(out, { recursive: true })

const modelPath = join(out, 'face_landmarker.task')
if (await exists(modelPath)) {
  console.log('face_landmarker.task already present')
} else {
  console.log(`downloading ${MODEL_URL}`)
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length < 1_000_000) throw new Error(`model looks truncated (${bytes.length} bytes)`)
  await writeFile(modelPath, bytes)
}

for (const name of WASM_FILES) {
  await copyFile(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm', name), join(out, name))
}

for (const name of ['face_landmarker.task', ...WASM_FILES]) {
  console.log(`${name}: ${((await stat(join(out, name))).size / 1e6).toFixed(2)} MB`)
}
