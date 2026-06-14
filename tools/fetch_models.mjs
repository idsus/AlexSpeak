// Copies the on-device ML model assets into public/models/ so everything is
// served locally and the app works fully offline (no CDN at runtime).
//
//   node tools/fetch_models.mjs
//
// - MediaPipe vision wasm            ← node_modules/@mediapipe/tasks-vision
// - face_landmarker.task             ← downloaded once from Google storage
//                                      (the only network access, build-time only)

import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')
const mpDir = join(root, 'public', 'models', 'mediapipe')

mkdirSync(join(mpDir, 'wasm'), { recursive: true })

const copies = [
  // MediaPipe vision wasm runtime
  [
    '@mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
    join(mpDir, 'wasm', 'vision_wasm_internal.js'),
  ],
  [
    '@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
    join(mpDir, 'wasm', 'vision_wasm_internal.wasm'),
  ],
  [
    '@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js',
    join(mpDir, 'wasm', 'vision_wasm_nosimd_internal.js'),
  ],
  [
    '@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm',
    join(mpDir, 'wasm', 'vision_wasm_nosimd_internal.wasm'),
  ],
]

for (const [from, to] of copies) {
  copyFileSync(join(nm, from), to)
  console.log(`copied  ${from}`)
}

const taskFile = join(mpDir, 'face_landmarker.task')
if (existsSync(taskFile)) {
  console.log('exists  face_landmarker.task (skipping download)')
} else {
  const url =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  console.log('downloading face_landmarker.task …')
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    writeFileSync(taskFile, Buffer.from(await response.arrayBuffer()))
    console.log('saved   face_landmarker.task')
  } catch (error) {
    console.warn(
      `WARNING: could not download face_landmarker.task (${error.message}). ` +
        'The mouth-movement channel will be unavailable until you re-run this script online. ' +
        'Audio detection and the caregiver button still work.',
    )
  }
}

console.log('done')
