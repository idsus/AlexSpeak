// Vite dev plugin: a local server-side TTS endpoint so the app speaks with one
// consistent, warm Kokoro voice in ANY browser — synthesis runs here on your
// computer (Node), not on the device, and nothing heavy ships to the browser.
//
//   GET /api/tts?text=Hello&voice=af_heart  ->  audio/wav
//
// The ~92 MB model loads once (downloaded on first use, then cached by
// transformers.js); results are cached in memory so repeated phrases are
// instant. On any error it returns 503 and the app falls back to the browser
// voice, so the app always works even if this is unavailable.

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const DEFAULT_VOICE = 'af_bella'

let ttsPromise = null
const cache = new Map() // `${voice}|${text}` -> Buffer (wav)

function loadTTS() {
  if (!ttsPromise) {
    ttsPromise = import('kokoro-js')
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'cpu' }),
      )
      .catch((error) => {
        ttsPromise = null
        throw error
      })
  }
  return ttsPromise
}

export function ttsServerPlugin() {
  return {
    name: 'alexspeak-tts-server',
    configureServer(server) {
      // Warm the model in the background so the first prompt isn't slow.
      loadTTS().then(
        () => server.config.logger.info('  ➜  TTS:     Kokoro voice ready (/api/tts)'),
        (error) => server.config.logger.warn(`  ➜  TTS:     unavailable (${error?.message ?? error})`),
      )

      server.middlewares.use('/api/tts', async (req, res) => {
        try {
          const params = new URL(req.url, 'http://localhost').searchParams
          const text = (params.get('text') || '').trim().slice(0, 300)
          const voice = params.get('voice') || DEFAULT_VOICE
          if (!text) {
            res.statusCode = 400
            res.end('missing text')
            return
          }
          const key = `${voice}|${text}`
          let wav = cache.get(key)
          if (!wav) {
            const tts = await loadTTS()
            const audio = await tts.generate(text, { voice })
            wav = Buffer.from(audio.toWav())
            cache.set(key, wav)
          }
          res.setHeader('Content-Type', 'audio/wav')
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          res.end(wav)
        } catch (error) {
          server.config.logger.warn(`[tts] ${error?.message ?? error}`)
          res.statusCode = 503
          res.end('tts unavailable')
        }
      })
    },
  }
}
