// Voice output. Prefers pre-rendered clips from /clips/<id>.mp3 (generated at
// build time by tools/generate_clips.py — premium warmth, zero latency, same
// voice every time). When a clip is missing it falls back to the Web Speech
// API with a slow, gentle delivery so the app is fully usable before any
// clips have been generated.

export interface PlayOptions {
  volume: number
  soundEnabled: boolean
  /** 'server' = warm Kokoro voice via /api/tts; 'system' = browser; 'recorded' = /clips first. */
  voiceMode?: 'server' | 'system' | 'recorded'
  /** Kokoro voice id for the server voice. */
  serverVoice?: string
  voiceName: string | null
}

export interface VoiceLike {
  name: string
  lang: string
  localService?: boolean
}

// 'missing' is cached so we only ever 404 once per clip id.
const clipCache = new Map<string, HTMLAudioElement | 'missing'>()

let currentAudio: HTMLAudioElement | null = null

// --- Voice selection ---------------------------------------------------------
// Browsers populate getVoices() asynchronously, so we cache and refresh on the
// 'voiceschanged' event. Without this the very first prompt (and the Settings
// picker) sees an empty list and silently uses the robotic OS default voice.

let cachedVoices: SpeechSynthesisVoice[] = []

function refreshVoices(): void {
  if (!('speechSynthesis' in window)) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) cachedVoices = voices
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
}

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  refreshVoices()
  if (cachedVoices.length || !('speechSynthesis' in window)) {
    return Promise.resolve(cachedVoices)
  }
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      refreshVoices()
      resolve(cachedVoices)
    }
    window.speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 1000)
  })
}

const WARM_VOICE_HINTS = [
  'natural', 'neural', 'aria', 'jenny', 'michelle', 'ava', 'samantha',
  'libby', 'sonia', 'clara', 'emma', 'nanci', 'zira', 'google',
]
const ROBOTIC_VOICE_HINTS = ['david', 'mark', 'george', 'hazel', 'richard', 'eddy', 'rocko', 'reed']

/** Rank a voice for warmth + intelligibility. Pure — unit-tested. */
export function scoreVoice(voice: VoiceLike): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase()
  let score = 0
  if (lang.startsWith('en-us')) score += 3
  else if (lang.startsWith('en-gb')) score += 2
  else if (lang.startsWith('en')) score += 1
  if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 4
  if (WARM_VOICE_HINTS.some((hint) => name.includes(hint))) score += 3
  if (ROBOTIC_VOICE_HINTS.some((hint) => name.includes(hint))) score -= 4
  if (voice.localService) score += 2 // offline-friendly tiebreak
  return score
}

/**
 * Choose the voice to speak with: the caregiver's explicit pick if it still
 * exists, otherwise the warmest available English voice. Pure — unit-tested.
 */
export function pickBestVoice<T extends VoiceLike>(voices: T[], chosenName: string | null): T | null {
  if (chosenName) {
    const exact = voices.find((voice) => voice.name === chosenName)
    if (exact) return exact
  }
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  const pool = english.length ? english : voices
  if (!pool.length) return null
  return pool.reduce((best, voice) => (scoreVoice(voice) > scoreVoice(best) ? voice : best))
}

export function stopAllPlayback(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

async function loadClip(id: string): Promise<HTMLAudioElement | null> {
  const cached = clipCache.get(id)
  if (cached === 'missing') return null
  if (cached) return cached
  for (const ext of ['wav', 'mp3']) {
    try {
      const response = await fetch(`/clips/${id}.${ext}`, { method: 'HEAD' })
      if (!response.ok) continue
      const audio = new Audio(`/clips/${id}.${ext}`)
      clipCache.set(id, audio)
      return audio
    } catch {
      // network/missing — try next extension
    }
  }
  clipCache.set(id, 'missing')
  return null
}

async function speakFallback(text: string, options: PlayOptions): Promise<void> {
  if (!('speechSynthesis' in window)) return
  const voices = await ensureVoices()

  return new Promise((resolve) => {
    let settled = false
    let timeout = 0
    let keepAlive = 0
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      window.clearInterval(keepAlive)
      resolve()
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92 // calm but natural — not sing-song
    utterance.pitch = 1.0 // adult-appropriate, not childish
    utterance.volume = options.volume
    const voice = pickBestVoice(voices, options.voiceName)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    // Chrome silently stops synthesis after ~15s and when backgrounded; nudge it.
    keepAlive = window.setInterval(() => {
      if (!settled) window.speechSynthesis.resume()
    }, 5000)
    // Safety net so the state machine never stalls if onend never fires.
    timeout = window.setTimeout(finish, Math.max(2200, text.length * 110))
    utterance.onend = finish
    utterance.onerror = finish
    // cancel() then an immediate speak() can drop the utterance in Chrome; a
    // microtask gap makes it reliable.
    window.speechSynthesis.cancel()
    window.setTimeout(() => {
      if (settled) return
      window.speechSynthesis.speak(utterance)
      window.speechSynthesis.resume()
    }, 30)
  })
}

/**
 * Play the clip with the given id, falling back to TTS with `text`.
 * Resolves when playback has fully ended — the state machine uses this as
 * its PROMPT_ENDED / MODEL_ENDED signal, and audio attempt firing stays paused until then.
 */
// --- Server voice (warm Kokoro via the local /api/tts endpoint) -------------
// Synthesis runs on the dev server (Node), so the voice is identical in any
// browser. Results are cached; if the endpoint is absent (e.g. a static build)
// we mark it down and fall back to the browser voice for the rest of the session.
const serverAudioCache = new Map<string, string>()
let serverTtsDown = false

async function synthesizeServer(text: string, voice: string): Promise<string | null> {
  if (serverTtsDown) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  const key = `${voice}|${trimmed}`
  const cached = serverAudioCache.get(key)
  if (cached) return cached
  try {
    const res = await fetch(
      `/api/tts?text=${encodeURIComponent(trimmed)}&voice=${encodeURIComponent(voice)}`,
    )
    if (!res.ok) {
      // 404 / not found → no endpoint here; stop trying. 503 → transient, retry later.
      if (res.status === 404) serverTtsDown = true
      return null
    }
    const blob = await res.blob()
    if (!blob.size || !blob.type.startsWith('audio')) return null
    const url = URL.createObjectURL(blob)
    serverAudioCache.set(key, url)
    return url
  } catch {
    serverTtsDown = true // endpoint unreachable (no dev server)
    return null
  }
}

/** Warm the server cache for phrases that are about to be spoken. */
export function prewarmServerVoice(texts: string[], voice: string): void {
  if (serverTtsDown) return
  for (const text of texts) void synthesizeServer(text, voice)
}

function playAudioElement(
  audio: HTMLAudioElement,
  volume: number,
  onAutoplayFail?: () => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    audio.volume = volume
    audio.currentTime = 0
    currentAudio = audio
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      resolve()
    }
    audio.onerror = () => resolve()
    audio.play().catch(() => {
      if (onAutoplayFail) onAutoplayFail().then(resolve)
      else resolve()
    })
  })
}

export async function play(id: string, text: string, options: PlayOptions): Promise<void> {
  if (!options.soundEnabled) {
    // Keep the visual pacing of the loop even with sound off.
    return new Promise((resolve) => setTimeout(resolve, Math.max(1600, text.length * 70)))
  }

  const mode = options.voiceMode ?? 'server'

  // Recorded mode prefers a pre-rendered clip if one exists.
  if (mode === 'recorded') {
    const clip = await loadClip(id)
    if (clip) return playAudioElement(clip, options.volume, () => speakFallback(text, options))
  }

  // Server (Kokoro) voice — the default, and the recorded fallback before Web Speech.
  if (mode === 'server' || mode === 'recorded') {
    const url = await synthesizeServer(text, options.serverVoice ?? 'af_bella')
    if (url) return playAudioElement(new Audio(url), options.volume)
  }

  // Universal fallback: the browser's Web Speech voice.
  return speakFallback(text, options)
}

export function listSystemVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  refreshVoices()
  return cachedVoices
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

/** Speak a short sample so a caregiver can audition the chosen voice. */
export function speakPreview(text: string, options: PlayOptions): Promise<void> {
  stopAllPlayback()
  return speakFallback(text, options)
}
