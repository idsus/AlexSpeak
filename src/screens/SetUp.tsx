import { useEffect, useRef, useState } from 'react'
import { DEFAULT_MOTIVATORS, type Motivator } from '../data/content'
import { displayName, type MicLevel, type Settings } from '../data/settings'
import { getAllTargetImages, putTargetImage } from '../data/imageStore'
import { fileToResizedDataUrl } from '../data/imageProcessing'
import { listSystemVoices, speakPreview } from '../audio/playClip'
import { MicMeter } from '../ui/MicMeter'

const LENGTHS: Settings['sessionMinutes'][] = [2, 3, 5]
const MIC_LEVELS: { id: MicLevel; label: string }[] = [
  { id: 'quiet', label: 'quiet voice' },
  { id: 'normal', label: 'normal' },
  { id: 'loud', label: 'loud room' },
]

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function SetUp({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const name = displayName(settings.childName)
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })

  const [photos, setPhotos] = useState<Record<string, string>>({})
  useEffect(() => {
    getAllTargetImages().then(setPhotos, () => {})
  }, [])

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    const load = () => setVoices(listSystemVoices())
    load()
    // Voices arrive late on most browsers.
    globalThis.speechSynthesis?.addEventListener?.('voiceschanged', load)
    return () => globalThis.speechSynthesis?.removeEventListener?.('voiceschanged', load)
  }, [])

  const all: Motivator[] = [...DEFAULT_MOTIVATORS, ...settings.customMotivators]
  const toggle = (id: string) =>
    set({ motivatorIds: settings.motivatorIds.includes(id) ? settings.motivatorIds.filter((x) => x !== id) : [...settings.motivatorIds, id] })

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const addPhoto = async (file: File | undefined) => {
    const shown = newName.trim().toLowerCase()
    if (!file || !shown) return
    setPhotoMsg('Saving…')
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      const existing = all.find((m) => m.id === `c-${slug(shown)}` || m.shown.toLowerCase() === shown)
      // c- prefix: a custom 'sock' must not collide with the neutral items' ids
      const mot: Motivator = existing ?? { id: `c-${slug(shown) || Date.now()}`, shown, spoken: shown, glyph: 'star' }
      await putTargetImage(mot.id, dataUrl)
      setPhotos((p) => ({ ...p, [mot.id]: dataUrl }))
      set({
        customMotivators: existing ? settings.customMotivators : [...settings.customMotivators, mot],
        motivatorIds: settings.motivatorIds.includes(mot.id) ? settings.motivatorIds : [...settings.motivatorIds, mot.id],
      })
      setAdding(false)
      setNewName('')
      setPhotoMsg('')
    } catch (err) {
      setPhotoMsg((err as Error)?.message || 'That photo could not be saved. Try another one.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setCalm = (calm: boolean) => {
    document.documentElement.dataset.calm = String(calm)
    set({ calm })
  }

  const hasVoice = 'speechSynthesis' in globalThis
  const voiceLabel = !hasVoice ? 'No voice on this tablet' : settings.voiceName ? `${settings.voiceName} (this tablet)` : 'Tablet default'

  return (
    <div className="pa-setup">
      <div className="pa-col">
        <section className="pa-card">
          <label htmlFor="pa-child-name" className="pa-label">Child's name</label>
          <input
            id="pa-child-name"
            className="pa-input"
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={40}
            value={settings.childName}
            onChange={(e) => set({ childName: e.target.value })}
          />
        </section>

        <section className="pa-card" aria-labelledby="pa-loves-h">
          <h2 id="pa-loves-h" className="pa-label">Things {name} loves</h2>
          <p className="pa-note">
            These show up in Ask for it, Choose and the Talk board. Add a photo of the real thing when you can — {name}'s own cup beats a drawing.
          </p>
          <div className="pa-chips">
            {all.map((m) => {
              const on = settings.motivatorIds.includes(m.id)
              return (
                <button key={m.id} type="button" className={`pa-chip${on ? ' pa-chip--on' : ''}`} aria-pressed={on} onClick={() => toggle(m.id)}>
                  {photos[m.id] && <img src={photos[m.id]} alt="" />}
                  {m.shown}
                </button>
              )
            })}
            {!adding && (
              <button type="button" className="pa-chip pa-chip--add" onClick={() => setAdding(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                add a photo
              </button>
            )}
          </div>
          {!all.some((m) => settings.motivatorIds.includes(m.id)) && (
            <p className="pa-note">Using bubbles, snack, car, tickle</p>
          )}
          {adding && (
            <div className="pa-add">
              <label htmlFor="pa-new-thing" className="pa-note">What is it? Use the word you say at home.</label>
              <input
                id="pa-new-thing"
                className="pa-input"
                type="text"
                autoComplete="off"
                maxLength={30}
                placeholder="cup"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="pa-add-actions">
                <button type="button" className="parent-btn pa-primary" disabled={!newName.trim()} onClick={() => fileRef.current?.click()}>
                  Choose a photo
                </button>
                <button type="button" className="parent-btn" onClick={() => { setAdding(false); setPhotoMsg('') }}>
                  Cancel
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void addPhoto(e.target.files?.[0])} />
              {photoMsg && <p className="pa-note" role="status">{photoMsg}</p>}
            </div>
          )}
        </section>
      </div>

      <div className="pa-col">
        <section className="pa-card" aria-labelledby="pa-len-h">
          <h2 id="pa-len-h" className="pa-label">How long is one play</h2>
          <div className="pa-seg" role="group" aria-labelledby="pa-len-h">
            {LENGTHS.map((m) => (
              <button key={m} type="button" aria-pressed={settings.sessionMinutes === m} onClick={() => set({ sessionMinutes: m })}>
                {m} min
              </button>
            ))}
          </div>
        </section>

        <section className="pa-card" aria-labelledby="pa-mic-h">
          <h2 id="pa-mic-h" className="pa-label">How loud is {name}</h2>
          <div className="pa-seg" role="group" aria-labelledby="pa-mic-h">
            {MIC_LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={settings.micLevel === l.id} onClick={() => set({ micLevel: l.id })}>
                {l.label}
              </button>
            ))}
          </div>
          <MicMeter micLevel={settings.micLevel} />
        </section>

        <section className="pa-card">
          <div className="pa-setting">
            <div>
              <div className="pa-setting-name" id="pa-calm-name">Calm mode</div>
              <div className="pa-note">No motion at all, softer sounds</div>
            </div>
            <button type="button" role="switch" className="pa-switch" aria-checked={settings.calm} aria-labelledby="pa-calm-name" onClick={() => setCalm(!settings.calm)}>
              <span />
            </button>
          </div>
          <div className="pa-setting">
            <div>
              <label className="pa-setting-name" htmlFor="pa-voice">Voice</label>
              <div className="pa-note">{voiceLabel}</div>
            </div>
            <div className="pa-voice">
              {voices.length > 0 && (
                <select
                  id="pa-voice"
                  className="pa-select"
                  disabled={!hasVoice}
                  value={settings.voiceName ?? ''}
                  onChange={(e) => set({ voiceName: e.target.value || null, voiceMode: 'system' })}
                >
                  <option value="">Tablet default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="parent-btn"
                disabled={!hasVoice}
                onClick={() => void speakPreview(`Hi ${settings.childName.trim() || 'there'}! Let's play.`, { volume: settings.volume, soundEnabled: true, voiceMode: 'system', voiceName: settings.voiceName })}
              >
                hear it
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
