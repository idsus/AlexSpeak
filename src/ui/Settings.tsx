import { useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  SHAPING_LABELS,
  WORD_LEVELS,
  normalizeWordEntry,
  wordsForLevel,
  type Settings,
  type ShapingLevel,
  type WordEntry,
  type WordLevelId,
} from '../data/settings'
import { listSystemVoices, play, speakPreview } from '../audio/playClip'

// Kokoro voices offered for the server voice.
const SERVER_VOICES: { id: string; label: string }[] = [
  { id: 'af_bella', label: 'Bella — bright & energetic' },
  { id: 'af_heart', label: 'Heart — warm & gentle' },
  { id: 'af_nicole', label: 'Nicole — soft' },
  { id: 'am_michael', label: 'Michael — calm male' },
  { id: 'bf_emma', label: 'Emma — British female' },
]
import { fileToResizedDataUrl } from '../data/imageProcessing'
import {
  deleteTargetImage,
  getAllTargetImages,
  putTargetImage,
} from '../data/imageStore'

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
    .flatMap((line) => {
      const [wordPart, soundPart, rewardPart, levelPart] = line.split('|').map((part) => part.trim())
      const [word, emoji] = wordPart.split(/\s+/)
      if (!word) return []
      return [normalizeWordEntry({
        word: word.toLowerCase(),
        emoji,
        targetSound: soundPart,
        reward: rewardPart,
        shapingLevel: levelPart as ShapingLevel,
      })]
    })
  return entries.length ? entries : DEFAULT_SETTINGS.words
}

function formatWord(entry: WordEntry): string {
  return `${entry.word} ${entry.emoji} | ${entry.targetSound} | ${entry.reward} | ${entry.shapingLevel}`
}

export default function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const [wordsText, setWordsText] = useState(
    settings.words.map(formatWord).join('\n'),
  )
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(listSystemVoices)
  const [images, setImages] = useState<Record<string, string>>({})
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busyWord, setBusyWord] = useState<string | null>(null)

  useEffect(() => {
    void getAllTargetImages().then(setImages)
  }, [])

  // Voices populate asynchronously in the browser — refresh when they arrive
  // so the picker is not empty on first open.
  useEffect(() => {
    const update = () => setVoices(listSystemVoices())
    update()
    window.speechSynthesis?.addEventListener?.('voiceschanged', update)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', update)
  }, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const selectLevel = (wordLevel: WordLevelId) => {
    const words = wordsForLevel(wordLevel)
    setDraft((d) => ({ ...d, wordLevel, words }))
    setWordsText(words.map(formatWord).join('\n'))
  }

  const previewText = `Hi ${draft.childName || 'there'}! Can you say ma?`

  const previewSystemVoice = () => {
    void speakPreview(previewText, {
      volume: draft.volume,
      soundEnabled: true,
      voiceMode: 'system',
      voiceName: draft.voiceName,
    })
  }

  const previewServerVoice = () => {
    void play('preview', previewText, {
      volume: draft.volume,
      soundEnabled: true,
      voiceMode: 'server',
      serverVoice: draft.serverVoice,
      voiceName: draft.voiceName,
    })
  }

  // Photos persist to IndexedDB immediately (independent of the Save button)
  // so a half-finished settings edit never loses an attached photo.
  const attachPhoto = async (word: string, file: File) => {
    setPhotoError(null)
    setBusyWord(word)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      await putTargetImage(word, dataUrl)
      setImages((current) => ({ ...current, [word]: dataUrl }))
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not save that photo')
    } finally {
      setBusyWord(null)
    }
  }

  const removePhoto = async (word: string) => {
    setPhotoError(null)
    await deleteTargetImage(word)
    setImages((current) => {
      const next = { ...current }
      delete next[word]
      return next
    })
  }

  const photoTargets = parseWords(wordsText)

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
          <label>Practice level</label>
          <div className="level-grid">
            {WORD_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                className={draft.wordLevel === level.id ? 'level-card active' : 'level-card'}
                onClick={() => selectLevel(level.id)}
              >
                <span>{level.label}</span>
                <small>{level.description}</small>
              </button>
            ))}
          </div>
          <span className="hint">Pick a level to load its word set, or edit the list below.</span>
        </div>

        <div className="field">
          <label>Targets (word emoji | model sound | real reward | rung)</label>
          <textarea
            rows={5}
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
          />
          <span className="hint">
            Example: apple 🍎 | ah | apple bite | anySound. Rungs:{' '}
            {Object.entries(SHAPING_LABELS)
              .map(([key, label]) => `${key}=${label}`)
              .join(' · ')}
          </span>
        </div>

        <div className="field">
          <label>Real-world photos</label>
          <span className="hint">
            Use a real photo of the actual thing — their own mug, the real door, the
            person being named. Photos stay on this device and replace the emoji.
          </span>
          <div className="photo-grid">
            {photoTargets.map((target) => (
              <div className="photo-item" key={target.word}>
                <div className="photo-thumb">
                  {images[target.word] ? (
                    <img src={images[target.word]} alt={target.word} />
                  ) : (
                    <span aria-hidden="true">{target.emoji}</span>
                  )}
                </div>
                <div className="photo-meta">
                  <strong>{target.word}</strong>
                  <div className="photo-actions">
                    <label className="btn-secondary photo-btn">
                      {busyWord === target.word
                        ? 'Saving…'
                        : images[target.word]
                          ? 'Replace'
                          : 'Add photo'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        data-photo-input={target.word}
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void attachPhoto(target.word, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {images[target.word] && (
                      <button
                        type="button"
                        className="btn-secondary photo-btn"
                        onClick={() => void removePhoto(target.word)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {photoError && <span className="hint photo-error">{photoError}</span>}
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

        <div className="field field-row">
          <input
            id="endlessMode"
            type="checkbox"
            checked={draft.endlessMode}
            onChange={(e) => set('endlessMode', e.target.checked)}
          />
          <label htmlFor="endlessMode">Endless practice — keep going until you press Stop</label>
        </div>

        {!draft.endlessMode && (
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
        )}

        <div className="field">
          <label>Vocal effort trigger: {draft.audioEffortThreshold}%</label>
          <input
            type="range"
            min={15}
            max={80}
            step={1}
            value={draft.audioEffortThreshold}
            onChange={(e) => set('audioEffortThreshold', Number(e.target.value))}
          />
          <span className="hint">Lower = easier to trigger. Raise it if random sounds still count.</span>
        </div>

        <div className="field">
          <label>Noise filter strength: {draft.audioNoiseRejection}%</label>
          <input
            type="range"
            min={35}
            max={90}
            step={1}
            value={draft.audioNoiseRejection}
            onChange={(e) => set('audioNoiseRejection', Number(e.target.value))}
          />
          <span className="hint">Higher = more strict about ignoring fans, taps, and background noise.</span>
        </div>

        <div className="field">
          <label>Personal voice model trigger: {draft.personalizedSpeechThreshold}%</label>
          <input
            type="range"
            min={45}
            max={95}
            step={1}
            value={draft.personalizedSpeechThreshold}
            onChange={(e) => set('personalizedSpeechThreshold', Number(e.target.value))}
          />
          <span className="hint">Used after collecting Alex examples in Developer mode.</span>
        </div>

        <div className="field field-row">
          <input
            id="autoTrainPersonalSpeech"
            type="checkbox"
            checked={draft.autoTrainPersonalSpeech}
            onChange={(e) => set('autoTrainPersonalSpeech', e.target.checked)}
          />
          <label htmlFor="autoTrainPersonalSpeech">Auto-train personal voice model from live feed</label>
        </div>

        <div className="field">
          <label>Alex voice range</label>
          <select
            value={draft.audioVoiceProfile}
            onChange={(e) =>
              set('audioVoiceProfile', e.target.value as Settings['audioVoiceProfile'])
            }
          >
            <option value="higher">Higher child voice</option>
            <option value="middle">Middle voice</option>
            <option value="lower">Lower voice</option>
            <option value="wide">Wide / unsure</option>
          </select>
          <span className="hint">Use the range that makes his “ah” raise Voice match, not room sounds.</span>
        </div>

        <div className="field">
          <label>Mouth movement trigger: {draft.mouthScoreThreshold}%</label>
          <input
            type="range"
            min={15}
            max={80}
            step={1}
            value={draft.mouthScoreThreshold}
            onChange={(e) => set('mouthScoreThreshold', Number(e.target.value))}
          />
          <span className="hint">Lower = smaller mouth openings count.</span>
        </div>

        <div className="field">
          <label>Webcam attention gate: {draft.attentionThreshold}%</label>
          <input
            type="range"
            min={15}
            max={85}
            step={1}
            value={draft.attentionThreshold}
            onChange={(e) => set('attentionThreshold', Number(e.target.value))}
          />
          <span className="hint">Lower if the camera is off-center or mounted far away.</span>
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
            id="devMode"
            type="checkbox"
            checked={draft.devMode}
            onChange={(e) => set('devMode', e.target.checked)}
          />
          <label htmlFor="devMode">Developer mode: show live detector boxes and scores</label>
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

        <div className="field">
          <label>Voice source</label>
          <select
            value={draft.voiceMode}
            onChange={(e) => set('voiceMode', e.target.value as Settings['voiceMode'])}
          >
            <option value="server">Warm voice — same in every browser (recommended)</option>
            <option value="system">System voice (browser male/female)</option>
            <option value="recorded">Recorded clips, when available</option>
          </select>
          <span className="hint">
            The warm voice is generated by this computer (npm run dev) so it sounds the
            same in any browser. It falls back to the system voice if the server is off.
          </span>
        </div>

        {draft.voiceMode === 'server' && (
          <div className="field">
            <label>Warm voice</label>
            <select
              value={draft.serverVoice}
              onChange={(e) => set('serverVoice', e.target.value)}
            >
              {SERVER_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="field-row">
              <button type="button" className="btn-secondary" onClick={previewServerVoice}>
                ▶ Preview voice
              </button>
            </div>
            <span className="hint">First preview may take a moment to warm up; then it is instant.</span>
          </div>
        )}

        {draft.voiceMode === 'system' && (
          <div className="field">
            <label>System voice</label>
            <select
              value={draft.voiceName ?? ''}
              onChange={(e) => set('voiceName', e.target.value || null)}
              disabled={voices.length === 0}
            >
              <option value="">Auto — warmest available</option>
              {voices.map((v) => (
                <option key={`${v.name}-${v.lang}`} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <div className="field-row">
              <button
                type="button"
                className="btn-secondary"
                disabled={voices.length === 0}
                onClick={previewSystemVoice}
              >
                ▶ Preview voice
              </button>
            </div>
            <span className="hint">
              Listed warmest-first. Preview a few and pick the one he responds to best.
            </span>
          </div>
        )}

        <div className="field-row">
          <button
            className="btn-primary btn-panel-action"
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
