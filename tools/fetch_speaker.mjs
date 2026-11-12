// Puts the speaker-embedding model in public/models/speaker/ so the app serves (and precaches)
// it itself. Used only to recognise an enrolled adult's voice, never to verify the child.
// Model: 3D-Speaker CAM++ (VoxCeleb, English), Apache-2.0, ONNX export from the sherpa-onnx
// model mirror, pinned to a commit and checked by hash. Usage: node tools/fetch_speaker.mjs
import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'models', 'speaker')
const NAME = 'campplus_en_voxceleb.onnx'
const URL =
  'https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/0743f301363dec56491a490f6d6cbc9d67f9a3bf/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx'
const SHA256 = '357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b'

const path = join(out, NAME)
const exists = await stat(path).then((s) => s.size > 0, () => false)
await mkdir(out, { recursive: true })
if (exists) {
  console.log(`${NAME} already present`)
} else {
  console.log(`downloading ${URL}`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`speaker model download failed: ${res.status} ${res.statusText}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== SHA256) throw new Error(`speaker model hash mismatch (${hash})`)
  await writeFile(path, bytes)
}
console.log(`${NAME}: ${((await stat(path)).size / 1e6).toFixed(2)} MB`)
