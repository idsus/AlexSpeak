import { play, stopAllPlayback } from './playClip'
import type { Settings } from '../data/settings'

export type VoiceSettings = Pick<Settings, 'volume' | 'voiceName' | 'voiceMode' | 'serverVoice'>

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Speak a line. Resolves when it has finished; resolves at once with no speech support; never rejects. */
export function speak(text: string, s: VoiceSettings): Promise<void> {
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window
  if (!hasSpeech && s.voiceMode !== 'server') return Promise.resolve()
  return play(slug(text), text, {
    volume: s.volume,
    soundEnabled: true,
    voiceMode: s.voiceMode,
    serverVoice: s.serverVoice,
    voiceName: s.voiceName,
  }).catch(() => {})
}

export function stopSpeaking(): void {
  try {
    stopAllPlayback()
  } catch {
    // nothing playing
  }
}
