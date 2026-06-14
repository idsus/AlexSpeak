import type { Phase } from '../engine/stateMachine'
import { SHAPING_LABELS, type WordEntry } from '../data/settings'
import type { AudioEffortScore } from '../audio/useAudioEffort'
import type { PersonalizedSpeechStatus } from '../audio/personalizedSpeech'
import type { VisionScore } from '../vision/useMouth'

interface Props {
  entry: WordEntry
  phase: Phase
  imageUrl?: string
  coachLine: string
  coachSpeaking: boolean
  adaptiveSupportLevel: number
  devMode: boolean
  autoTrainPersonalSpeech: boolean
  personalSpeech: PersonalizedSpeechStatus | null
  onCollectTargetExample: () => void | Promise<unknown>
  onCollectBackgroundExample: () => void | Promise<unknown>
  onTrainPersonalModel: () => void | Promise<unknown>
  scores: {
    audio: AudioEffortScore | null
    vision: VisionScore | null
  }
}

function statusTone(active: boolean, available: boolean): string {
  if (!available) return 'muted'
  return active ? 'ready' : 'watching'
}

export default function PromptScreen({
  entry,
  phase,
  imageUrl,
  scores,
  coachLine,
  coachSpeaking,
  adaptiveSupportLevel,
  devMode,
  autoTrainPersonalSpeech,
  personalSpeech,
  onCollectTargetExample,
  onCollectBackgroundExample,
  onTrainPersonalModel,
}: Props) {
  const audio = scores.audio
  const vision = scores.vision
  const voiceReady = Boolean(audio && audio.score >= audio.threshold)
  const attentionReady = Boolean(vision?.ready)
  const responseText =
    phase === 'listen'
      ? audio?.reason === 'voice accepted'
        ? 'Voice heard'
        : audio?.reason === 'voice too quiet'
          ? 'Try a little louder'
          : audio?.reason === 'not voice-like enough'
            ? 'Listening for Alex’s voice'
            : vision?.facePresent
              ? 'Camera sees Alex'
              : 'Waiting for Alex'
      : phase === 'model'
        ? 'Modeling the sound'
        : 'Getting ready'

  return (
    <main className="screen session-screen">
      <section className="coach-stage" aria-label="speech model">
        <div className={`digital-coach ${coachSpeaking ? 'speaking' : ''}`} aria-hidden="true">
          <div className="coach-face">
            <span className="coach-eye coach-eye-left" />
            <span className="coach-eye coach-eye-right" />
            <span className="coach-mouth" />
          </div>
        </div>
        <p className="coach-bubble">{coachLine}</p>
      </section>

      <section
        className={`target-stage ${phase === 'listen' ? 'is-live' : ''}`}
        aria-label={`say ${entry.word}`}
      >
        <div className="target-art" aria-hidden="true">
          <span className="target-halo" />
          {imageUrl ? (
            <img className="target-photo say-pop" src={imageUrl} alt={entry.word} />
          ) : (
            <div className="target-emoji say-pop">{entry.emoji}</div>
          )}
        </div>
        <div className="say-block">
          <p className="say-eyebrow">Say this</p>
          <h1 className="word say-word">{entry.word}</h1>
          <p className="target-cue">
            {SHAPING_LABELS[entry.shapingLevel]} · sound: {entry.targetSound}
          </p>
        </div>
      </section>

      <section className={`response-state ${phase === 'listen' ? 'is-listening' : ''}`}>
        <span className="pulse-dot" aria-hidden="true" />
        <span>{responseText}</span>
      </section>

      <aside className="caregiver-status" aria-label="caregiver signal status">
        <span className={`status-chip ${statusTone(voiceReady, Boolean(audio))}`}>
          Voice {audio?.calibrating ? 'calibrating' : voiceReady ? 'ready' : audio ? 'listening' : 'off'}
        </span>
        <span className={`status-chip ${statusTone(attentionReady, Boolean(vision))}`}>
          Camera {attentionReady ? 'ready' : vision ? 'watching' : 'off'}
        </span>
        {adaptiveSupportLevel > 0 && (
          <span className="status-chip ready">Support adjusted</span>
        )}
        <span className="status-chip reward-chip">Reward: {entry.reward}</span>
      </aside>

      {devMode && (
        <aside className="dev-signal-panel" aria-label="developer detector values">
          <div>
            <strong>Audio</strong>
            <span>score {audio?.score ?? 0}/{audio?.threshold ?? 0}</span>
            <span>volume {audio?.volume ?? 0}/{audio?.volumeGate ?? 0}</span>
            <span>voice {audio?.voiceMatch ?? 0}/{audio?.voiceGate ?? 0}</span>
            <span>noise {audio?.noise ?? 0}</span>
            <span>{audio?.reason ?? 'no audio channel'}</span>
          </div>
          <div>
            <strong>Personal model</strong>
            <span>target examples {personalSpeech?.targetExamples ?? 0}</span>
            <span>noise examples {personalSpeech?.backgroundExamples ?? 0}</span>
            <span>auto Alex {personalSpeech?.autoTargetExamples ?? 0}</span>
            <span>auto noise {personalSpeech?.autoBackgroundExamples ?? 0}</span>
            <span>target score {personalSpeech?.targetScore ?? 0}/{personalSpeech?.threshold ?? 0}</span>
            <span>{autoTrainPersonalSpeech ? 'auto-train on' : 'auto-train off'}</span>
            <span>
              {personalSpeech?.autoTraining
                ? 'training now'
                : personalSpeech?.collecting
                  ? 'collecting sample'
                  : personalSpeech?.trained
                    ? 'trained'
                    : 'not trained'}
            </span>
            <span>pending samples {personalSpeech?.samplesSinceTrain ?? 0}</span>
            <span>{personalSpeech?.reason ?? 'not loaded'}</span>
            <div className="dev-actions">
              <button className="btn-secondary" onClick={onCollectTargetExample}>
                Add Alex sound
              </button>
              <button className="btn-secondary" onClick={onCollectBackgroundExample}>
                Add noise
              </button>
              <button className="btn-secondary" onClick={onTrainPersonalModel}>
                Train
              </button>
            </div>
          </div>
          <div>
            <strong>Webcam</strong>
            <span>mouth {vision?.mouth ?? 0}/{vision?.mouthThreshold ?? 0}</span>
            <span>attention {vision?.attention ?? 0}/{vision?.attentionThreshold ?? 0}</span>
            <span>steady {vision?.faceSteady ?? 0}/55</span>
            <span>{vision?.facePresent ? 'face present' : 'no face'}</span>
          </div>
        </aside>
      )}
    </main>
  )
}
