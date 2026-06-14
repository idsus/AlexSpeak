// Copies the on-device ML model assets into public/models/ so everything is
// served locally and the app works fully offline (no CDN at runtime).
//
//   node tools/fetch_models.mjs
//
// - MediaPipe vision wasm            ← node_modules/@mediapipe/tasks-vision
// - face_landmarker.task             ← downloaded once from Google storage
// - speech-commands base model       ← downloaded once from Google storage,
//                                      so the personalized VOICE RECORDING model
//                                      loads locally and works fully offline
//                                      (otherwise tfjs fetches it at runtime and
//                                       the recording feature breaks offline / on
//                                       a GitHub Pages deploy)
//   (network access is build-time only)

import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')
const mpDir = join(root, 'public', 'models', 'mediapipe')
const scDir = join(root, 'public', 'models', 'speech-commands')

mkdirSync(join(mpDir, 'wasm'), { recursive: true })
mkdirSync(scDir, { recursive: true })

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

// --- Speech-commands base model (for the offline personalized voice model) ---
// @tensorflow-models/speech-commands@0.5.x loads its BROWSER_FFT base model from
// this URL at runtime by default. We download it once so personalizedSpeech can
// point at the local copy and the recording feature works with no network.
const SC_BASE =
  'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w'
const scFiles = ['model.json', 'metadata.json', 'group1-shard1of2', 'group1-shard2of2']

for (const file of scFiles) {
  const dest = join(scDir, file)
  if (existsSync(dest)) {
    console.log(`exists  speech-commands/${file}`)
    continue
  }
  try {
    console.log(`downloading speech-commands/${file} …`)
    const response = await fetch(`${SC_BASE}/${file}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    writeFileSync(dest, Buffer.from(await response.arrayBuffer()))
    console.log(`saved   speech-commands/${file}`)
  } catch (error) {
    console.warn(
      `WARNING: could not download speech-commands/${file} (${error.message}). ` +
        'The personalized voice model will fall back to its online base model ' +
        '(needs network). Re-run this script online to make it fully offline.',
    )
  }
}

console.log('done')
