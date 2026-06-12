import { useEffect, useRef, useState } from 'react'
import {
  createInitialState,
  reduce,
  type EngineEvent,
  type EngineState,
  type Channel,
} from './engine/stateMachine'
import { DetectionFuser } from './engine/detection'
import {
  PRAISE_LINES,
  ENCOURAGE_LINES,
  SESSION_END_LINES,
  makePicker,
  promptText,
  modelText,
  promptClipId,
  modelClipId,
  type Phrase,
} from './engine/phrases'
import { loadSettings, saveSettings, type Settings } from './data/settings'
import { appendTrial } from './data/sessionLog'
import type { VadChannel } from './audio/useVAD'
import { getCameraStream } from './audio/useMic'
import { play, stopAllPlayback } from './audio/playClip'
import type { MouthChannel } from './vision/useMouth'
import PromptScreen from './ui/PromptScreen'
import RewardScreen from './ui/RewardScreen'
import CaregiverButton from './ui/CaregiverButton'
import SettingsPanel from './ui/Settings'
import Progress from './ui/Progress'

type View = 'home' | 'session' | 'settings' | 'progress'

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [view, setView] = useState<View>('home')
  const [engineState, setEngineState] = useState<EngineState>(createInitialState)
  const [loading, setLoading] = useState(false)
  const [channelNotice, setChannelNotice] = useState<string | null>(null)
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const fuserRef = useRef<DetectionFuser | null>(null)
  const vadRef = useRef<VadChannel | null>(null)
  const mouthRef = useRef<MouthChannel | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const listenStartRef = useRef<number | null>(null)
  const latencyRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string>('')

  const pickPraise = useRef(makePicker(PRAISE_LINES)).current
  const pickEncourage = useRef(makePicker(ENCOURAGE_LINES)).current
  const pickEnd = useRef(makePicker(SESSION_END_LINES)).current

  const config = () => ({
    words: settingsRef.current.words.map((w) => w.word),
    maxReprompts: settingsRef.current.maxReprompts,
    trialsPerSession: settingsRef.current.trialsPerSession,
  })

  const dispatch = (event: EngineEvent) =>
    setEngineState((s) => reduce(s, config(), event))

  const playOpts = () => ({
    volume: settingsRef.current.volume,
    soundEnabled: settingsRef.current.soundEnabled,
    voiceName: settingsRef.current.voiceName,
  })

  const handleAttempt = (channel: Channel) => {
    latencyRef.current =
      listenStartRef.current !== null
        ? Math.round(performance.now() - listenStartRef.current)
        : 0
    dispatch({ type: 'ATTEMPT', channel })
  }

  async function teardownChannels() {
    await vadRef.current?.destroy().catch(() => {})
    vadRef.current = null
    mouthRef.current?.destroy()
    mouthRef.current = null
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
  }

  async function startSession() {
    setView('session')
    setLoading(true)
    setChannelNotice(null)
    sessionIdRef.current = `s-${Date.now()}`

    const fuser = new DetectionFuser(handleAttempt)
    fuserRef.current = fuser
    const notices: string[] = []

    try {
      // Dynamic import keeps the ML runtime (onnxruntime-web) out of the
      // initial bundle — it only loads once a session actually starts.
      const { VadChannel } = await import('./audio/useVAD')
      vadRef.current = await VadChannel.create({
        sensitivity: settingsRef.current.audioSensitivity,
        onAttempt: () => fuser.report('audio'),
      })
      await vadRef.current.pause()
    } catch {
      notices.push('Sound detection unavailable')
    }

    if (settingsRef.current.cameraEnabled) {
      try {
        const stream = await getCameraStream()
        cameraStreamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const { MouthChannel } = await import('./vision/useMouth')
        mouthRef.current = await MouthChannel.create(video, {
          sensitivity: settingsRef.current.mouthSensitivity,
          onAttempt: () => fuser.report('mouth'),
        })
      } catch {
        notices.push('Mouth detection unavailable')
      }
    }

    if (notices.length) {
      setChannelNotice(`${notices.join(' · ')} — the “I saw it!” button always works.`)
    }
    setLoading(false)
    dispatch({ type: 'START_SESSION' })
  }

  function stopSession() {
    stopAllPlayback()
    dispatch({ type: 'STOP' })
  }

  // Side effects per phase. The state machine is pure; everything async
  // (clips, timers, detector gating) lives here, keyed on phase re-entry.
  useEffect(() => {
    if (view !== 'session') return
    let cancelled = false
    const state = engineState
    const words = settingsRef.current.words
    const entry = words[state.wordIndex % words.length]
    const opts = playOpts()

    switch (state.phase) {
      case 'prompt': {
        fuserRef.current?.arm()
        listenStartRef.current = null
        latencyRef.current = null
        play(promptClipId(entry.word), promptText(settingsRef.current.childName, entry.word), opts)
          .then(() => !cancelled && dispatch({ type: 'PROMPT_ENDED' }))
        break
      }

      case 'listen': {
        listenStartRef.current = performance.now()
        vadRef.current?.resume()
        mouthRef.current?.start()
        const timer = setTimeout(
          () => dispatch({ type: 'LISTEN_TIMEOUT' }),
          settingsRef.current.listenWindowMs,
        )
        return () => {
          cancelled = true
          clearTimeout(timer)
          vadRef.current?.pause()
          mouthRef.current?.stop()
        }
      }

      case 'model': {
        play(modelClipId(entry.word), modelText(entry.word), opts)
          .then(() => !cancelled && dispatch({ type: 'MODEL_ENDED' }))
        break
      }

      case 'celebrate': {
        fuserRef.current?.disarm()
        appendTrial({
          timestamp: Date.now(),
          sessionId: sessionIdRef.current,
          word: entry.word,
          channel: state.lastChannel,
          latencyMs: latencyRef.current,
          repromptCount: state.repromptCount,
          success: true,
        })
        const praise = pickPraise()
        setCurrentPhrase(praise)
        play(praise.id, praise.text, opts)
          .then(() => new Promise((r) => setTimeout(r, 1800)))
          .then(() => !cancelled && dispatch({ type: 'CELEBRATE_DONE' }))
        break
      }

      case 'encourage': {
        fuserRef.current?.disarm()
        appendTrial({
          timestamp: Date.now(),
          sessionId: sessionIdRef.current,
          word: entry.word,
          channel: null,
          latencyMs: null,
          repromptCount: state.repromptCount,
          success: false,
        })
        const line = pickEncourage()
        setCurrentPhrase(line)
        play(line.id, line.text, opts)
          .then(() => !cancelled && dispatch({ type: 'ENCOURAGE_DONE' }))
        break
      }

      case 'sessionEnd': {
        fuserRef.current?.disarm()
        const line = pickEnd()
        setCurrentPhrase(line)
        play(line.id, line.text, opts)
        teardownChannels()
        break
      }

      case 'idle': {
        teardownChannels()
        setView('home')
        break
      }
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState.phase, engineState.trialIndex, engineState.repromptCount, view])

  const entry =
    settings.words[engineState.wordIndex % settings.words.length] ?? settings.words[0]
  const inTrial = ['prompt', 'listen', 'model'].includes(engineState.phase)

  return (
    <>
      {/* Hidden-ish camera feed for MediaPipe; small preview helps aim the camera */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="camera-preview"
        style={{
          display:
            view === 'session' && settings.cameraEnabled && cameraStreamRef.current
              ? 'block'
              : 'none',
        }}
      />

      {view === 'home' && (
        <div className="screen">
          <div className="big-emoji">🗣️</div>
          <h1 style={{ margin: 0 }}>AlexSpeak</h1>
          <p className="subtitle">
            Gentle word practice that celebrates every try —<br />
            every sound, every mouth movement, every effort.
          </p>
          <button className="btn-primary" onClick={startSession}>
            ▶ Start
          </button>
          <div className="field-row">
            <button className="btn-secondary" onClick={() => setView('settings')}>
              ⚙️ Caregiver settings
            </button>
            <button className="btn-secondary" onClick={() => setView('progress')}>
              📈 Progress
            </button>
          </div>
          <p className="notice">
            Uses the microphone{settings.cameraEnabled ? ' and camera' : ''} on this
            device only. Nothing is recorded or uploaded — everything stays here.
          </p>
        </div>
      )}

      {view === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSave={(s) => {
            saveSettings(s)
            setSettings(s)
            setView('home')
          }}
          onClose={() => setView('home')}
        />
      )}

      {view === 'progress' && <Progress onClose={() => setView('home')} />}

      {view === 'session' && (
        <>
          <button className="stop-btn" onClick={stopSession}>
            ✋ Stop
          </button>

          {loading && (
            <div className="screen">
              <div className="big-emoji">🌤️</div>
              <div className="subtitle">Getting ready…</div>
            </div>
          )}

          {!loading && inTrial && <PromptScreen entry={entry} phase={engineState.phase} />}

          {!loading && engineState.phase === 'celebrate' && (
            <RewardScreen praiseText={currentPhrase?.text ?? 'Wonderful!'} emoji={entry.emoji} />
          )}

          {!loading && engineState.phase === 'encourage' && (
            <div className="screen">
              <div className="big-emoji">💛</div>
              <div className="word">{currentPhrase?.text}</div>
            </div>
          )}

          {!loading && engineState.phase === 'sessionEnd' && (
            <div className="screen">
              <div className="big-emoji">🌈</div>
              <div className="word">All done!</div>
              <div className="subtitle">
                {engineState.successCount} wonderful{' '}
                {engineState.successCount === 1 ? 'try' : 'tries'} today
              </div>
              <button className="btn-primary" onClick={() => dispatch({ type: 'DISMISS' })}>
                🏠 Home
              </button>
            </div>
          )}

          {inTrial && !loading && (
            <CaregiverButton onPress={() => fuserRef.current?.report('manual')} />
          )}

          {channelNotice && !loading && <div className="notice top-row">{channelNotice}</div>}
        </>
      )}
    </>
  )
}
