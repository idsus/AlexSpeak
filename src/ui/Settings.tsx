import { useState } from 'react'
import { DEFAULT_SETTINGS, type Settings, type WordEntry } from '../data/settings'
import { listSystemVoices } from '../audio/playClip'

interface Props {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

function parseWords(text: string): WordEntry[] {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [word, emoji] = line.split(/\s+/)
      return { word: word.toLowerCase(), emoji: emoji || '⭐' }
    })
  return entries.length ? entries : DEFAULT_SETTINGS.words
}

export default function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const [wordsText, setWordsText] = useState(
    settings.words.map((w) => `${w.word} ${w.emoji}`).join('\n'),
  )
  const voices = listSystemVoices()

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="screen">
      <div className="panel">
        <h2>Caregiver settings</h2>

        <div className="field">
          <label>Name used in prompts</label>
          <input
            type="text"
            value={draft.childName}
            onChange={(e) => set('childName', e.target.value)}
          />
        </div>

        <div className="field">
          <label>Target words (one per line: word, then emoji)</label>
          <textarea
            rows={5}
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
          />
          <span className="hint">Example: “apple 🍎”. Pick words an SLP suggests if you have one.</span>
        </div>

        <div className="field">
          <label>Listen window: {(draft.listenWindowMs / 1000).toFixed(0)} s</label>
          <input
            type="range"
            min={3000}
            max={12000}
            step={1000}
            value={draft.listenWindowMs}
            onChange={(e) => set('listenWindowMs', Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>Gentle re-prompts before moving on: {draft.maxReprompts}</label>
          <input
            type="range"
            min={1}
            max={3}
            value={draft.maxReprompts}
            onChange={(e) => set('maxReprompts', Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>Words per session: {draft.trialsPerSession}</label>
          <input
            type="range"
            min={3}
            max={10}
            value={draft.trialsPerSession}
            onChange={(e) => set('trialsPerSession', Number(e.target.value))}
          />
          <span className="hint">Short is good. Better to end early on a win.</span>
        </div>

        <div className="field">
          <label>Sound sensitivity</label>
          <input
            type="range"
            min={0.15}
            max={0.6}
            step={0.05}
            // Inverted so that "more sensitive" is to the right.
            value={0.75 - draft.audioSensitivity}
            onChange={(e) => set('audioSensitivity', 0.75 - Number(e.target.value))}
          />
          <span className="hint">Further right = quieter sounds count. When unsure, go right.</span>
        </div>

        <div className="field">
          <label>Mouth-movement sensitivity</label>
          <input
            type="range"
            min={0.1}
            max={0.5}
            step={0.05}
            value={0.6 - draft.mouthSensitivity}
            onChange={(e) => set('mouthSensitivity', 0.6 - Number(e.target.value))}
          />
        </div>

        <div className="field field-row">
          <input
            id="camera"
            type="checkbox"
            checked={draft.cameraEnabled}
            onChange={(e) => set('cameraEnabled', e.target.checked)}
          />
          <label htmlFor="camera">Use camera to spot silent mouth movements</label>
        </div>

        <div className="field field-row">
          <input
            id="sound"
            type="checkbox"
            checked={draft.soundEnabled}
            onChange={(e) => set('soundEnabled', e.target.checked)}
          />
          <label htmlFor="sound">Voice prompts on</label>
        </div>

        <div className="field">
          <label>Volume</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={draft.volume}
            onChange={(e) => set('volume', Number(e.target.value))}
          />
        </div>

        {voices.length > 0 && (
          <div className="field">
            <label>Fallback voice (when no recorded clips exist)</label>
            <select
              value={draft.voiceName ?? ''}
              onChange={(e) => set('voiceName', e.target.value || null)}
            >
              <option value="">Browser default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
            <span className="hint">Let him hear a couple and pick the one he responds to.</span>
          </div>
        )}

        <div className="field-row">
          <button
            className="btn-primary"
            style={{ fontSize: 20, padding: '14px 32px' }}
            onClick={() => onSave({ ...draft, words: parseWords(wordsText) })}
          >
            Save
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
