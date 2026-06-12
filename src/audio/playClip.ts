// Voice output. Prefers pre-rendered clips from /clips/<id>.mp3 (generated at
// build time by tools/generate_clips.py — premium warmth, zero latency, same
// voice every time). When a clip is missing it falls back to the Web Speech
// API with a slow, gentle delivery so the app is fully usable before any
// clips have been generated.

export interface PlayOptions {
  volume: number
  soundEnabled: boolean
  voiceName: string | null
}

// 'missing' is cached so we only ever 404 once per clip id.
const clipCache = new Map<string, HTMLAudioElement | 'missing'>()

let currentAudio: HTMLAudioElement | null = null

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

function speakFallback(text: string, options: PlayOptions): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.85 // slow and calm
    utterance.pitch = 1.05
    utterance.volume = options.volume
    if (options.voiceName) {
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.name === options.voiceName)
      if (voice) utterance.voice = voice
    }
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Play the clip with the given id, falling back to TTS with `text`.
 * Resolves when playback has fully ended — the state machine uses this as
 * its PROMPT_ENDED / MODEL_ENDED signal, and the VAD stays paused until then.
 */
export async function play(id: string, text: string, options: PlayOptions): Promise<void> {
  if (!options.soundEnabled) {
    // Keep the visual pacing of the loop even with sound off.
    return new Promise((resolve) => setTimeout(resolve, 1200))
  }

  const clip = await loadClip(id)
  if (!clip) return speakFallback(text, options)

  return new Promise((resolve) => {
    clip.volume = options.volume
    clip.currentTime = 0
    currentAudio = clip
    clip.onended = () => {
      if (currentAudio === clip) currentAudio = null
      resolve()
    }
    clip.onerror = () => resolve()
    clip.play().catch(() => {
      // Autoplay rejection or decode failure — fall back to TTS.
      speakFallback(text, options).then(resolve)
    })
  })
}

export function listSystemVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
}
