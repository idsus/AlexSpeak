import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  listenCoachText,
  promptClipId,
  modelClipId,
  coachClipId,
  type Phrase,
} from './engine/phrases'
import {
  WORD_LEVELS,
  loadSettings,
  saveSettings,
  wordsForLevel,
  type Settings,
  type WordLevelId,
} from './data/settings'
import {
  createAdaptiveSupportState,
  criteriaForTarget,
  criteriaWithAdaptiveSupport,
  nearAttemptWindow,
  nextShapingLevel,
  previousShapingLevel,
  supportLevelForNearAttempts,
  type ShapingCriteria,
} from './engine/shaping'
import { appendTrial } from './data/sessionLog'
import { getAllTargetImages } from './data/imageStore'
import type { AudioEffortChannel, AudioEffortScore } from './audio/useAudioEffort'
import type { PersonalizedSpeechModel, PersonalizedSpeechStatus } from './audio/personalizedSpeech'
import { getCameraStream } from './audio/useMic'
import { play, stopAllPlayback, prewarmServerVoice } from './audio/playClip'
import type { MouthChannel, VisionScore } from './vision/useMouth'
import PromptScreen from './ui/PromptScreen'
import RewardScreen from './ui/RewardScreen'
import CaregiverButton from './ui/CaregiverButton'
import SettingsPanel from './ui/Settings'
import Progress from './ui/Progress'

type View = 'home' | 'session' | 'settings' | 'progress'

interface SensorScores {
  audio: AudioEffortScore | null
  vision: VisionScore | null
}

interface AssistCandidate {
  channel: Channel
  label: string
  confidence: number
}

const AUTO_TARGET_SAMPLE_COOLDOWN_MS = 5200
const AUTO_BACKGROUND_SAMPLE_COOLDOWN_MS = 8500
const PERSONAL_MODEL_STARTUP_TIMEOUT_MS = 4500

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

function debugBoxStyle(
  box: { x: number; y: number; width: number; height: number } | undefined,
): CSSProperties {
  if (!box) return { display: 'none' }
  return {
    left: `${(1 - box.x - box.width) * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [view, setView] = useState<View>('home')
  const [engineState, setEngineState] = useState<EngineState>(createInitialState)
  const [loading, setLoading] = useState(false)
  const [channelNotice, setChannelNotice] = useState<string | null>(null)
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null)
  const [coachLine, setCoachLine] = useState('')
  const [coachSpeaking, setCoachSpeaking] = useState(false)
  const [adaptiveSupportLevel, setAdaptiveSupportLevel] = useState(0)
  const [assistCandidate, setAssistCandidate] = useState<AssistCandidate | null>(null)
  const [sensorScores, setSensorScores] = useState<SensorScores>({
    audio: null,
    vision: null,
  })
  const [personalStatus, setPersonalStatus] = useState<PersonalizedSpeechStatus | null>(null)
  // Real-world photos for each target (word → data URL), kept on-device.
  const [targetImages, setTargetImages] = useState<Record<string, string>>({})
  // Zoom-style webcam preview visibility. Detection keeps running when hidden.
  const [showWebcam, setShowWebcam] = useState(true)
  // Paused mid-session: freezes the loop, stops the voice, and pauses detectors
  // until resumed (which re-enters the current step).
  const [paused, setPaused] = useState(false)
  const sensorScoresRef = useRef<SensorScores>({
    audio: null,
    vision: null,
  })

  const refreshTargetImages = () => {
    void getAllTargetImages().then(setTargetImages)
  }

  useEffect(() => {
    refreshTargetImages()
  }, [])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const engineStateRef = useRef(engineState)
  engineStateRef.current = engineState
  const coachSpeakingRef = useRef(coachSpeaking)
  coachSpeakingRef.current = coachSpeaking

  const fuserRef = useRef<DetectionFuser | null>(null)
  const audioRef = useRef<AudioEffortChannel | null>(null)
  const personalSpeechRef = useRef<PersonalizedSpeechModel | null>(null)
  const mouthRef = useRef<MouthChannel | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const listenStartRef = useRef<number | null>(null)
  const latencyRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string>('')
  const successStreakRef = useRef<Record<string, number>>({})
  const missStreakRef = useRef<Record<string, number>>({})
  const supportRef = useRef(createAdaptiveSupportState())
  const lastNearAttemptAtRef = useRef(0)
  const lastAssistPromptAtRef = useRef(0)
  const autoSpeechBusyRef = useRef(false)
  const lastAutoTargetSampleAtRef = useRef(0)
  const lastAutoBackgroundSampleAtRef = useRef(0)
  // Identifies the live session. Bumped when a session starts or tears down so
  // a detector created by a superseded/stopped session can't fire its
  // callbacks (onAttempt/onScore/onStatus) into the current one.
  const sessionTokenRef = useRef(0)

  const pickPraise = useRef(makePicker(PRAISE_LINES)).current
  const pickEncourage = useRef(makePicker(ENCOURAGE_LINES)).current
  const pickEnd = useRef(makePicker(SESSION_END_LINES)).current

  const config = () => ({
    words: settingsRef.current.words.map((w) => w.word),
    maxReprompts: settingsRef.current.maxReprompts,
    trialsPerSession: settingsRef.current.trialsPerSession,
    endless: settingsRef.current.endlessMode,
  })

  const dispatch = (event: EngineEvent) =>
    setEngineState((s) => reduce(s, config(), event))

  const playOpts = () => ({
    volume: settingsRef.current.volume,
    soundEnabled: settingsRef.current.soundEnabled,
    voiceMode: settingsRef.current.voiceMode,
    serverVoice: settingsRef.current.serverVoice,
    voiceName: settingsRef.current.voiceName,
  })

  const currentEntry = () => {
    const words = settingsRef.current.words
    return words[engineStateRef.current.wordIndex % words.length] ?? words[0]
  }

  const currentCriteria = (entry = currentEntry()): ShapingCriteria | null => {
    if (!entry) return null
    return criteriaWithAdaptiveSupport(
      criteriaForTarget(settingsRef.current, entry),
      entry,
      supportRef.current.supportLevel,
    )
  }

  const applyTargetCriteria = () => {
    const entry = currentEntry()
    const criteria = currentCriteria(entry)
    if (!criteria) return
    audioRef.current?.setSensitivity(criteria.audioEffortThreshold)
    audioRef.current?.setNoiseRejection(criteria.audioNoiseRejection)
    mouthRef.current?.setSensitivity(criteria.mouthScoreThreshold)
    mouthRef.current?.setAttentionThreshold(criteria.attentionThreshold)
    // Re-arm (not disable): if we are mid-listen the channel must stay active.
    mouthRef.current?.rearm()
    personalSpeechRef.current?.setThreshold(settingsRef.current.personalizedSpeechThreshold)
  }

  const resetAdaptiveSupport = () => {
    supportRef.current = createAdaptiveSupportState()
    lastNearAttemptAtRef.current = 0
    lastAssistPromptAtRef.current = 0
    setAdaptiveSupportLevel(0)
    setAssistCandidate(null)
    applyTargetCriteria()
  }

  const registerNearAttempt = (entry = currentEntry()) => {
    if (!entry) return
    const now = performance.now()
    if (now - lastNearAttemptAtRef.current < 550) return
    lastNearAttemptAtRef.current = now
    supportRef.current.nearAttempts += 1
    const nextSupportLevel = supportLevelForNearAttempts(supportRef.current.nearAttempts)
    if (nextSupportLevel !== supportRef.current.supportLevel) {
      supportRef.current.supportLevel = nextSupportLevel
      setAdaptiveSupportLevel(nextSupportLevel)
      applyTargetCriteria()
    }
  }

  const maybeSuggestSupportedAttempt = (channel: Channel, score: number, threshold: number) => {
    if (supportRef.current.supportLevel < 3) return
    if (score < threshold - 6) return

    const now = performance.now()
    if (now - lastAssistPromptAtRef.current < 2500) return
    lastAssistPromptAtRef.current = now

    const distance = Math.max(0, threshold - score)
    setAssistCandidate({
      channel,
      label: channel === 'audio' ? 'heard a close vocal try' : 'saw a close mouth try',
      confidence: Math.max(55, Math.min(92, Math.round(92 - distance * 6))),
    })
  }

  const suggestMouthCandidate = (confidence: number) => {
    const now = performance.now()
    if (now - lastAssistPromptAtRef.current < 1800) return
    lastAssistPromptAtRef.current = now
    setAssistCandidate({
      channel: 'mouth',
      label: 'saw a possible mouth try',
      confidence,
    })
  }

  const handleAudioScore = (audio: AudioEffortScore) => {
    sensorScoresRef.current = { ...sensorScoresRef.current, audio }
    setSensorScores(sensorScoresRef.current)
    const entry = currentEntry()
    const criteria = currentCriteria(entry)
    const state = engineStateRef.current
    if (!entry || !criteria || state.phase !== 'listen' || coachSpeakingRef.current) return
    if (!audio.listening || audio.calibrating) return

    maybeAutoTrainPersonalSpeech(audio, criteria)

    supportRef.current.bestAudioScore = Math.max(supportRef.current.bestAudioScore, audio.score)
    const nearWindow = nearAttemptWindow(supportRef.current.supportLevel)
    const hasVocalEffort = audio.score >= criteria.audioEffortThreshold - nearWindow
    const soundsLikeVoice = audio.voiceMatch >= criteria.audioNoiseRejection - nearWindow
    if (hasVocalEffort && soundsLikeVoice && audio.volume >= 10) {
      registerNearAttempt(entry)
      maybeSuggestSupportedAttempt('audio', audio.score, criteria.audioEffortThreshold)
    }
  }

  const handleVisionScore = (vision: VisionScore) => {
    sensorScoresRef.current = { ...sensorScoresRef.current, vision }
    setSensorScores(sensorScoresRef.current)
    const entry = currentEntry()
    const criteria = currentCriteria(entry)
    const state = engineStateRef.current
    if (!entry || !criteria || state.phase !== 'listen' || coachSpeakingRef.current) return

    supportRef.current.bestMouthScore = Math.max(supportRef.current.bestMouthScore, vision.mouth)
    const nearWindow = nearAttemptWindow(supportRef.current.supportLevel)
    const mouthEffort = vision.mouth >= criteria.mouthScoreThreshold - nearWindow
    const enoughAttention =
      vision.facePresent &&
      vision.attention >= criteria.attentionThreshold - nearWindow - 4 &&
      vision.faceSteady >= 45

    if (mouthEffort && enoughAttention) {
      registerNearAttempt(entry)
      if (criteria.acceptMouth || supportRef.current.supportLevel >= 3) {
        maybeSuggestSupportedAttempt('mouth', vision.mouth, criteria.mouthScoreThreshold)
      }
    }
  }

  const handleMouthAttemptCandidate = () => {
    const state = engineStateRef.current
    if (state.phase !== 'listen' || coachSpeakingRef.current) return
    registerNearAttempt()
    suggestMouthCandidate(70)
  }

  const queueAutoSpeechSample = (kind: 'target' | 'background') => {
    const model = personalSpeechRef.current
    if (!model || autoSpeechBusyRef.current) return

    autoSpeechBusyRef.current = true
    const collect =
      kind === 'target'
        ? model.autoCollectTargetExample()
        : model.autoCollectBackgroundExample()
    collect
      .catch((error) => {
        console.warn('Auto speech training sample failed:', error)
      })
      .finally(() => {
        autoSpeechBusyRef.current = false
      })
  }

  const maybeAutoTrainPersonalSpeech = (
    audio: AudioEffortScore,
    criteria: ShapingCriteria,
  ) => {
    if (!settingsRef.current.autoTrainPersonalSpeech) return
    if (!personalSpeechRef.current || autoSpeechBusyRef.current) return

    const now = performance.now()
    const vision = sensorScoresRef.current.vision
    const webcamSpeakerGate =
      !settingsRef.current.cameraEnabled ||
      !vision ||
      (vision.facePresent &&
        vision.attention >= Math.max(45, criteria.attentionThreshold - 8) &&
        vision.faceSteady >= 42)

    const strongAlexLikeSound =
      webcamSpeakerGate &&
      audio.passesNoiseGate &&
      audio.score >= Math.max(criteria.audioEffortThreshold + 16, 68) &&
      audio.voiceMatch >= Math.max(criteria.audioNoiseRejection + 14, 72) &&
      audio.volume >= Math.max(audio.volumeGate + 8, 20)

    if (
      strongAlexLikeSound &&
      now - lastAutoTargetSampleAtRef.current >= AUTO_TARGET_SAMPLE_COOLDOWN_MS
    ) {
      lastAutoTargetSampleAtRef.current = now
      queueAutoSpeechSample('target')
      return
    }

    const cleanBackgroundWindow =
      audio.listening &&
      !audio.calibrating &&
      audio.volume <= audio.volumeGate + 3 &&
      audio.voiceMatch <= Math.max(0, criteria.audioNoiseRejection - 10) &&
      audio.score <= Math.max(0, criteria.audioEffortThreshold - 18)

    if (
      cleanBackgroundWindow &&
      now - lastAutoBackgroundSampleAtRef.current >= AUTO_BACKGROUND_SAMPLE_COOLDOWN_MS
    ) {
      lastAutoBackgroundSampleAtRef.current = now
      queueAutoSpeechSample('background')
    }
  }

  const applyShapingOutcome = (word: string, success: boolean) => {
    const current = settingsRef.current
    const target = current.words.find((entry) => entry.word === word)
    if (!target) return

    if (success) {
      successStreakRef.current[word] = (successStreakRef.current[word] ?? 0) + 1
      missStreakRef.current[word] = 0
    } else {
      missStreakRef.current[word] = (missStreakRef.current[word] ?? 0) + 1
      successStreakRef.current[word] = 0
    }

    const nextLevel =
      success && successStreakRef.current[word] >= 3
        ? nextShapingLevel(target.shapingLevel)
        : !success && missStreakRef.current[word] >= 2
          ? previousShapingLevel(target.shapingLevel)
          : target.shapingLevel

    if (nextLevel === target.shapingLevel) return

    successStreakRef.current[word] = 0
    missStreakRef.current[word] = 0
    const updated = {
      ...current,
      words: current.words.map((entry) =>
        entry.word === word ? { ...entry, shapingLevel: nextLevel } : entry,
      ),
    }
    settingsRef.current = updated
    saveSettings(updated)
    setSettings(updated)
  }

  const handleAttempt = (channel: Channel) => {
    setAssistCandidate(null)
    latencyRef.current =
      listenStartRef.current !== null
        ? Math.round(performance.now() - listenStartRef.current)
        : 0
    dispatch({ type: 'ATTEMPT', channel })
  }

  async function teardownChannels() {
    // Invalidate the current session first so any in-flight detector callback
    // becomes a no-op before we start releasing the underlying resources.
    sessionTokenRef.current += 1
    await audioRef.current?.destroy().catch(() => {})
    audioRef.current = null
    personalSpeechRef.current?.stop()
    personalSpeechRef.current = null
    mouthRef.current?.destroy()
    mouthRef.current = null
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
  }

  async function startSession() {
    setView('session')
    setLoading(true)
    setPaused(false)
    setChannelNotice(null)
    sensorScoresRef.current = { audio: null, vision: null }
    setSensorScores(sensorScoresRef.current)
    autoSpeechBusyRef.current = false
    lastAutoTargetSampleAtRef.current = 0
    lastAutoBackgroundSampleAtRef.current = 0
    sessionIdRef.current = `s-${Date.now()}`

    // Warm the server voice for the first prompt + common praise so the first
    // utterance isn't slow (fire-and-forget; no-op if the server isn't running).
    if (settingsRef.current.voiceMode === 'server') {
      const first = settingsRef.current.words[0]
      const texts = first
        ? [
            promptText(settingsRef.current.childName, first.word, first.targetSound, first.shapingLevel),
            listenCoachText(settingsRef.current.childName, first.word, first.targetSound, first.shapingLevel),
            ...PRAISE_LINES.slice(0, 5).map((p) => p.text),
          ]
        : PRAISE_LINES.slice(0, 5).map((p) => p.text)
      prewarmServerVoice(texts, settingsRef.current.serverVoice)
    }

    // Claim this session. Any earlier session's detector callbacks (guarded by
    // isCurrent) stop firing immediately.
    const token = (sessionTokenRef.current += 1)
    const isCurrent = () => sessionTokenRef.current === token

    // If the caregiver hits Stop while we are still awaiting a detector's
    // startup, release whatever we just built instead of leaking it into a
    // session that no longer exists.
    const discardIfSuperseded = async (cleanup: () => void | Promise<void>) => {
      if (isCurrent()) return false
      await Promise.resolve(cleanup()).catch(() => {})
      return true
    }

    const fuser = new DetectionFuser(handleAttempt)
    fuserRef.current = fuser
    const notices: string[] = []

    try {
      // Dynamic import keeps microphone setup out of the initial bundle and
      // only asks for media access once a session actually starts.
      const { AudioEffortChannel } = await import('./audio/useAudioEffort')
      const initialEntry = settingsRef.current.words[0]
      const criteria = initialEntry
        ? criteriaForTarget(settingsRef.current, initialEntry)
        : {
            audioEffortThreshold: settingsRef.current.audioEffortThreshold,
            audioNoiseRejection: settingsRef.current.audioNoiseRejection,
          }
      const channel = await AudioEffortChannel.create({
        sensitivity: criteria.audioEffortThreshold,
        noiseRejection: criteria.audioNoiseRejection,
        voiceProfile: settingsRef.current.audioVoiceProfile,
        onAttempt: () => isCurrent() && fuser.report('audio'),
        onScore: (score) => isCurrent() && handleAudioScore(score),
      })
      if (await discardIfSuperseded(() => channel.destroy())) return
      audioRef.current = channel
      await channel.pause()
    } catch (error) {
      console.warn('Audio detector unavailable:', error)
      notices.push('Sound detection unavailable')
    }

    try {
      const { PersonalizedSpeechModel } = await import('./audio/personalizedSpeech')
      const model = await withTimeout(
        PersonalizedSpeechModel.create({
          threshold: settingsRef.current.personalizedSpeechThreshold,
          onAttempt: () => isCurrent() && fuser.report('audio'),
          onStatus: (status) => isCurrent() && setPersonalStatus(status),
        }),
        PERSONAL_MODEL_STARTUP_TIMEOUT_MS,
        'Personalized speech model startup timed out',
      )
      if (await discardIfSuperseded(() => model.stop())) return
      personalSpeechRef.current = model
    } catch (error) {
      console.warn('Personalized speech model unavailable:', error)
      notices.push('Personal voice model unavailable')
    }

    if (settingsRef.current.cameraEnabled) {
      try {
        const stream = await getCameraStream()
        if (await discardIfSuperseded(() => stream.getTracks().forEach((t) => t.stop()))) return
        cameraStreamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const { MouthChannel } = await import('./vision/useMouth')
        const initialEntry = settingsRef.current.words[0]
        const criteria = initialEntry
          ? criteriaForTarget(settingsRef.current, initialEntry)
          : {
              mouthScoreThreshold: settingsRef.current.mouthScoreThreshold,
              attentionThreshold: settingsRef.current.attentionThreshold,
            }
        const channel = await MouthChannel.create(video, {
          sensitivity: criteria.mouthScoreThreshold,
          attentionThreshold: criteria.attentionThreshold,
          onAttempt: () => isCurrent() && handleMouthAttemptCandidate(),
          onScore: (score) => isCurrent() && handleVisionScore(score),
        })
        if (await discardIfSuperseded(() => channel.destroy())) return
        mouthRef.current = channel
        channel.start()
      } catch (error) {
        console.warn('Mouth channel unavailable:', error)
        notices.push('Mouth detection unavailable')
      }
    }

    if (!isCurrent()) return
    if (notices.length) {
      setChannelNotice(`${notices.join(' · ')} — the “I saw it!” button always works.`)
    }
    setLoading(false)
    dispatch({ type: 'START_SESSION' })
  }

  function stopSession() {
    stopAllPlayback()
    setCoachSpeaking(false)
    setAssistCandidate(null)
    setPaused(false)
    dispatch({ type: 'STOP' })
    teardownChannels()
    setView('home')
  }

  // Switch the active difficulty level. If a session is running, restart it
  // cleanly on the new word set.
  async function changeWordLevel(wordLevel: WordLevelId) {
    if (settingsRef.current.wordLevel === wordLevel) return
    const next = { ...settingsRef.current, wordLevel, words: wordsForLevel(wordLevel) }
    settingsRef.current = next
    saveSettings(next)
    setSettings(next)
    if (view === 'session') {
      stopAllPlayback()
      setCoachSpeaking(false)
      setAssistCandidate(null)
      setPaused(false)
      await teardownChannels()
      startSession()
    }
  }

  // Side effects per phase. The state machine is pure; everything async
  // (clips, timers, detector gating) lives here, keyed on phase re-entry.
  useEffect(() => {
    if (view !== 'session') return
    // Paused: stop the voice and freeze detectors; the previous run's cleanup
    // already cleared its timers. Resuming re-runs this effect, which re-enters
    // the current step (re-plays the prompt / re-opens the listen window).
    if (paused) {
      stopAllPlayback()
      setCoachSpeaking(false)
      audioRef.current?.pause()
      personalSpeechRef.current?.stop()
      mouthRef.current?.setAttemptEnabled(false)
      return
    }
    let cancelled = false
    const state = engineState
    const words = settingsRef.current.words
    const entry = words[state.wordIndex % words.length]
    const opts = playOpts()
    const criteria = criteriaForTarget(settingsRef.current, entry)
    audioRef.current?.setSensitivity(criteria.audioEffortThreshold)
    audioRef.current?.setNoiseRejection(criteria.audioNoiseRejection)
    mouthRef.current?.setSensitivity(criteria.mouthScoreThreshold)
    mouthRef.current?.setAttentionThreshold(criteria.attentionThreshold)

    switch (state.phase) {
      case 'prompt': {
        resetAdaptiveSupport()
        applyTargetCriteria()
        fuserRef.current?.arm()
        listenStartRef.current = null
        latencyRef.current = null
        const text = promptText(
          settingsRef.current.childName,
          entry.word,
          entry.targetSound,
          entry.shapingLevel,
        )
        setCoachLine(text)
        setCoachSpeaking(true)
        play(
          promptClipId(entry.word),
          text,
          opts,
        ).then(() => {
          if (cancelled) return
          setCoachSpeaking(false)
          dispatch({ type: 'PROMPT_ENDED' })
        })
        break
      }

      case 'listen': {
        listenStartRef.current = performance.now()
        setCoachLine(
          listenCoachText(
            settingsRef.current.childName,
            entry.word,
            entry.targetSound,
            entry.shapingLevel,
          ),
        )
        setCoachSpeaking(false)
        audioRef.current?.resume()
        personalSpeechRef.current?.start()
        // Arm the webcam mouth channel for the live listen window. It only
        // ever raises a "count it?" suggestion — it never auto-completes.
        mouthRef.current?.setAttemptEnabled(true)
        let coachTimer: number | undefined
        let coachBusy = false
        const runCoach = async () => {
          if (cancelled || coachBusy) return
          coachBusy = true
          const text = listenCoachText(
            settingsRef.current.childName,
            entry.word,
            entry.targetSound,
            entry.shapingLevel,
          )
          setCoachLine(text)
          setCoachSpeaking(true)
          audioRef.current?.pause()
          personalSpeechRef.current?.stop()
          mouthRef.current?.setAttemptEnabled(false)
          await play(coachClipId(entry.word), text, opts)
          if (!cancelled) {
            setCoachSpeaking(false)
            await audioRef.current?.resume()
            personalSpeechRef.current?.start()
            mouthRef.current?.setAttemptEnabled(true)
            // Stay warm and present — re-cue often enough to feel like a vocal
            // companion, while still leaving clear quiet gaps for him to answer.
            coachTimer = window.setTimeout(runCoach, 4800)
          }
          coachBusy = false
        }
        coachTimer = window.setTimeout(runCoach, 2800)
        const timer = setTimeout(
          () => dispatch({ type: 'LISTEN_TIMEOUT' }),
          settingsRef.current.listenWindowMs,
        )
        return () => {
          cancelled = true
          setCoachSpeaking(false)
          clearTimeout(timer)
          if (coachTimer) clearTimeout(coachTimer)
          audioRef.current?.pause()
          personalSpeechRef.current?.stop()
          mouthRef.current?.setAttemptEnabled(false)
        }
      }

      case 'model': {
        const text = modelText(entry.word, state.repromptCount, entry.targetSound, entry.shapingLevel)
        setCoachLine(text)
        setCoachSpeaking(true)
        play(
          modelClipId(entry.word),
          text,
          opts,
        ).then(() => {
          if (cancelled) return
          setCoachSpeaking(false)
          dispatch({ type: 'MODEL_ENDED' })
        })
        break
      }

      case 'celebrate': {
        setCoachSpeaking(false)
        setAssistCandidate(null)
        fuserRef.current?.disarm()
        appendTrial({
          timestamp: Date.now(),
          sessionId: sessionIdRef.current,
          word: entry.word,
          targetSound: entry.targetSound,
          shapingLevel: entry.shapingLevel,
          reward: entry.reward,
          channel: state.lastChannel,
          latencyMs: latencyRef.current,
          repromptCount: state.repromptCount,
          success: true,
        })
        applyShapingOutcome(entry.word, true)
        const praise = pickPraise()
        setCurrentPhrase(praise)
        play(praise.id, praise.text, opts)
          .then(() => new Promise((r) => setTimeout(r, 1000)))
          .then(() => !cancelled && dispatch({ type: 'CELEBRATE_DONE' }))
        break
      }

      case 'encourage': {
        setCoachSpeaking(false)
        setAssistCandidate(null)
        fuserRef.current?.disarm()
        appendTrial({
          timestamp: Date.now(),
          sessionId: sessionIdRef.current,
          word: entry.word,
          targetSound: entry.targetSound,
          shapingLevel: entry.shapingLevel,
          reward: entry.reward,
          channel: null,
          latencyMs: null,
          repromptCount: state.repromptCount,
          success: false,
        })
        applyShapingOutcome(entry.word, false)
        const line = pickEncourage()
        setCurrentPhrase(line)
        play(line.id, line.text, opts)
          .then(() => !cancelled && dispatch({ type: 'ENCOURAGE_DONE' }))
        break
      }

      case 'sessionEnd': {
        setCoachSpeaking(false)
        setAssistCandidate(null)
        fuserRef.current?.disarm()
        const line = pickEnd()
        setCurrentPhrase(line)
        play(line.id, line.text, opts)
        teardownChannels()
        break
      }

      // 'idle' is deliberately not handled here: this effect re-runs when the
      // view changes, and entering the session view happens while the machine
      // is still idle — a teardown here would cancel the session as it starts.
      // Teardown lives in stopSession() and the DISMISS handler instead.
      case 'idle':
        break
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState.phase, engineState.trialIndex, engineState.repromptCount, view, paused])

  const entry =
    settings.words[engineState.wordIndex % settings.words.length] ?? settings.words[0]
  const inTrial = ['prompt', 'listen', 'model'].includes(engineState.phase)
  const currentLevel = WORD_LEVELS.find((l) => l.id === settings.wordLevel) ?? WORD_LEVELS[0]

  return (
    <>
      {/* Zoom-style webcam preview. The <video> stays live (it is only made
          transparent, never display:none) whenever the camera is on, so the AI
          keeps reading frames even while the preview is hidden. */}
      <div
        className={`webcam-pip ${showWebcam ? '' : 'is-hidden'} ${settings.devMode ? 'dev' : ''}`}
        style={{
          display:
            view === 'session' && settings.cameraEnabled && cameraStreamRef.current
              ? 'block'
              : 'none',
        }}
      >
        <video ref={videoRef} muted playsInline className="camera-preview" />
        {settings.devMode && showWebcam && (
          <>
            <span
              className="debug-box debug-box-face"
              style={debugBoxStyle(sensorScores.vision?.faceBox)}
            />
            <span
              className="debug-box debug-box-mouth"
              style={debugBoxStyle(sensorScores.vision?.mouthBox)}
            />
            <span className="debug-label">Webcam AI: face box + mouth target</span>
          </>
        )}
      </div>

      {view === 'home' && (
        <main className="screen home-screen">
          <div className="brand-mark" aria-hidden="true">
            AS
          </div>
          <h1 className="app-title">AlexSpeak</h1>
          <p className="subtitle">
            Guided speech practice for modeled sounds, approximations, and caregiver-confirmed tries.
          </p>
          <div className="home-levels" aria-label="Practice level">
            <div className="level-title">{currentLevel.label} — {currentLevel.description}</div>
            <div className="level-grid">
              {WORD_LEVELS.map((level) => (
                <button
                  key={level.id}
                  className={settings.wordLevel === level.id ? 'level-card active' : 'level-card'}
                  onClick={() => changeWordLevel(level.id)}
                >
                  <span>{level.label}</span>
                  <small>{level.description}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={startSession}>
            Start session
          </button>
          <div className="field-row">
            <button className="btn-secondary" onClick={() => setView('settings')}>
              Caregiver settings
            </button>
            <button className="btn-secondary" onClick={() => setView('progress')}>
              Progress
            </button>
          </div>
          <p className="notice">
            Uses the microphone{settings.cameraEnabled ? ' and camera' : ''} on this
            device only. Nothing is recorded or uploaded — everything stays here.
          </p>
        </main>
      )}

      {view === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSave={(s) => {
            saveSettings(s)
            setSettings(s)
            refreshTargetImages()
            setView('home')
          }}
          onClose={() => {
            refreshTargetImages()
            setView('home')
          }}
        />
      )}

      {view === 'progress' && <Progress onClose={() => setView('home')} />}

      {view === 'session' && (
        <>
          <button className="stop-btn" onClick={stopSession}>
            Stop
          </button>

          {inTrial && !loading && !paused && (
            <button className="pause-btn" onClick={() => setPaused(true)}>
              ⏸ Pause
            </button>
          )}

          {paused && (
            <div className="pause-overlay" role="dialog" aria-label="Paused">
              <div className="pause-card">
                <div className="pause-icon" aria-hidden="true">⏸</div>
                <div className="word">Paused</div>
                <p className="subtitle">Take a break — pick up right where you left off.</p>
                <button className="btn-primary" onClick={() => setPaused(false)}>
                  ▶ Resume
                </button>
                <button className="btn-secondary" onClick={stopSession}>
                  Stop session
                </button>
              </div>
            </div>
          )}

          <div className="level-switch" aria-label="Change practice level">
            {WORD_LEVELS.map((level) => (
              <button
                key={level.id}
                className={settings.wordLevel === level.id ? 'level-pill active' : 'level-pill'}
                onClick={() => changeWordLevel(level.id)}
              >
                {level.label.replace('Level ', 'L')}
              </button>
            ))}
          </div>

          {settings.cameraEnabled && (
            <button
              className="webcam-toggle"
              onClick={() => setShowWebcam((v) => !v)}
              aria-pressed={!showWebcam}
              title={showWebcam ? 'Hide camera preview' : 'Show camera preview'}
            >
              {showWebcam ? '📷 Hide camera' : '📷 Show camera'}
            </button>
          )}

          {loading && (
            <div className="screen">
              <div className="brand-mark" aria-hidden="true">
                AS
              </div>
              <div className="subtitle">Getting ready…</div>
            </div>
          )}

          {!loading && inTrial && (
            <PromptScreen
              entry={entry}
              phase={engineState.phase}
              imageUrl={targetImages[entry.word]}
              scores={sensorScores}
              coachLine={coachLine}
              coachSpeaking={coachSpeaking}
              adaptiveSupportLevel={adaptiveSupportLevel}
              devMode={settings.devMode}
              autoTrainPersonalSpeech={settings.autoTrainPersonalSpeech}
              personalSpeech={personalStatus}
              onCollectTargetExample={() => personalSpeechRef.current?.collectTargetExample()}
              onCollectBackgroundExample={() => personalSpeechRef.current?.collectBackgroundExample()}
              onTrainPersonalModel={() => personalSpeechRef.current?.train()}
            />
          )}

          {!loading && engineState.phase === 'celebrate' && (
            <RewardScreen
              praiseText={currentPhrase?.text ?? 'Wonderful!'}
              emoji={entry.emoji}
              reward={entry.reward}
              imageUrl={targetImages[entry.word]}
            />
          )}

          {!loading && engineState.phase === 'encourage' && (
            <div className="screen">
              <div className="brand-mark" aria-hidden="true">
                AS
              </div>
              <div className="word">{currentPhrase?.text}</div>
            </div>
          )}

          {!loading && engineState.phase === 'sessionEnd' && (
            <div className="screen">
              <div className="brand-mark" aria-hidden="true">
                AS
              </div>
              <div className="word">All done!</div>
              <div className="subtitle">
                {engineState.successCount} wonderful{' '}
                {engineState.successCount === 1 ? 'try' : 'tries'} today
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  dispatch({ type: 'DISMISS' })
                  setView('home')
                }}
              >
                Home
              </button>
            </div>
          )}

          {inTrial && !loading && (
            <CaregiverButton onPress={() => fuserRef.current?.report('manual')} />
          )}

          {inTrial && !loading && assistCandidate && (
            <div className="assist-confirm" role="status">
              <div>
                <strong>I think that was a try.</strong>
                <span>
                  {assistCandidate.label} · {assistCandidate.confidence}% confidence
                </span>
              </div>
              <button
                className="btn-primary assist-yes"
                onClick={() => {
                  const channel = assistCandidate.channel
                  setAssistCandidate(null)
                  fuserRef.current?.report(channel)
                }}
              >
                Count it
              </button>
              <button className="btn-secondary assist-no" onClick={() => setAssistCandidate(null)}>
                Keep trying
              </button>
            </div>
          )}

          {channelNotice && !loading && <div className="notice top-row">{channelNotice}</div>}
        </>
      )}
    </>
  )
}
