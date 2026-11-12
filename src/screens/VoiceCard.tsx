import { useState } from 'react'
import { MAX_PARENTS, type Settings } from '../data/settings'
import { enrol } from '../engine/eval/speaker'
import { loadSpeaker } from '../audio/speakerModel'
import { RecRing, useRecorder } from './Recorder'

const ENROL_S = 10

/**
 * "Your voice": up to two adults record ~10 s so the engine can drop their voices.
 * Only the averaged embedding is stored, never the recording.
 */
export function VoiceCard({ settings, name, set }: { settings: Settings; name: string; set: (patch: Partial<Settings>) => void }) {
  const rec = useRecorder()
  const [working, setWorking] = useState<number | null>(null) // which adult slot is being recorded
  const [msg, setMsg] = useState('')
  const voices = settings.parentVoices

  const record = async (slot: number) => {
    setWorking(slot)
    setMsg('')
    try {
      const clip = await rec.record(ENROL_S)
      if (!clip) return
      setMsg('Saving…')
      const speaker = await loadSpeaker().catch(() => null)
      if (!speaker) return setMsg('The voice model is not on this tablet yet, so every voice still counts. Nothing else changes.')
      const { voice, pitch } = await enrol(clip, (x) => speaker.embed(x)).catch(() => ({ voice: null, pitch: 0 }))
      if (!voice) return setMsg('That was too quiet to learn from. Record again a little closer to the tablet.')
      const parentVoices = [...voices]
      const parentPitch = [...settings.parentPitch]
      parentVoices[slot] = voice
      parentPitch[slot] = Math.round(pitch)
      set({ parentVoices, parentPitch })
      setMsg('Saved. Only a voice fingerprint is kept, never the recording.')
    } catch {
      setMsg('The microphone is not available. Allow it in this browser\'s settings.')
    } finally {
      setWorking(null)
    }
  }

  const forget = (slot: number) => {
    set({ parentVoices: voices.filter((_, i) => i !== slot), parentPitch: settings.parentPitch.filter((_, i) => i !== slot) })
    setMsg('Forgotten.')
  }

  const button = (slot: number, label: string) => (
    <button type="button" className="parent-btn" disabled={rec.busy || working !== null} onClick={() => void record(slot)}>
      <RecRing busy={rec.busy && working === slot} step={rec.step} seconds={ENROL_S} />
      {rec.busy && working === slot ? 'Keep talking…' : label}
    </button>
  )

  return (
    <section className="pa-card" aria-labelledby="pa-voice-h">
      <h2 id="pa-voice-h" className="pa-label">Your voice</h2>
      <p className="pa-note">Say a few sentences so the app can tell your voice from {name}'s.</p>
      {voices.length === 0 && <div className="pa-add-actions">{button(0, 'Record my voice')}</div>}
      {voices.map((_, slot) => (
        <div key={slot} className="pa-setting">
          <div className="pa-setting-name">{slot === 0 ? 'Your voice' : 'Second adult'} is saved</div>
          <div className="pa-add-actions">
            {button(slot, 'Redo')}
            <button type="button" className="parent-btn" disabled={rec.busy} onClick={() => forget(slot)}>
              Forget {slot === 0 ? 'my' : 'this'} voice
            </button>
          </div>
        </div>
      ))}
      {voices.length > 0 && voices.length < MAX_PARENTS && <div className="pa-add-actions">{button(voices.length, 'Add another adult')}</div>}
      {msg && <p className="pa-note" role="status">{msg}</p>}
    </section>
  )
}
