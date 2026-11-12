import { SpeakerEmbedder } from '../engine/eval/speaker'

const MODEL_DIR = import.meta.env.BASE_URL + 'models/'

let loading: Promise<SpeakerEmbedder> | null = null

/** The speaker model, loaded on first use (enrolment or a session with an enrolled adult) and kept. */
export function loadSpeaker(): Promise<SpeakerEmbedder> {
  loading ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = { wasm: `${MODEL_DIR}vad/ort-wasm-simd-threaded.wasm` }
    const res = await fetch(`${MODEL_DIR}speaker/campplus_en_voxceleb.onnx`)
    if (!res.ok) throw new Error(`speaker model: HTTP ${res.status}`)
    return SpeakerEmbedder.create(ort, new Uint8Array(await res.arrayBuffer()))
  })()
  // A failed load can be retried later (e.g. after the model is fetched).
  loading.catch(() => (loading = null))
  return loading
}
