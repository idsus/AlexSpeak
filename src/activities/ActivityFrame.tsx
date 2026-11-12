import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { activityInfo, fillTip, type ActivityId, type Target } from '../data/content'
import { activeMotivators, displayName, type Settings } from '../data/settings'
import { appendRecord, type LogRecord, type Rung } from '../data/log'
import { ENCOURAGE_LINES, makePicker } from '../engine/phrases'
import { speak, stopSpeaking } from '../audio/voice'
import { useAttempt } from '../audio/useAttempt'
import { useAttention } from '../vision/useAttention'
import type { Segment } from '../engine/eval/engine'
import { offerChildTemplate } from '../data/templates'
import { recordHeard, suggest, type Suggested } from './segments'
import { Pip, type PipMood } from '../ui/Pip'
import { HoldButton } from '../ui/HoldButton'
import { TrialRunner, type TrialOptions, type TrialOutcome } from './trial'
import { CelebrateOverlay, RungChips } from './Celebrate'
import { MicCard } from './MicCard'
import './frame.css'

export type { TrialOutcome } from './trial'

export interface FrameApi {
  runTrial(target: Target, opts?: TrialOptions): Promise<TrialOutcome>
  say(text: string): Promise<void>
  touch(): void
  listening: boolean
  celebrating: boolean
  pipMood: PipMood
}

const CELEBRATE_MS = 1500
const CHIPS_MS = 3000
const NEVER = new Promise<never>(() => {})
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const PIP_CENTRE: ActivityId[] = ['choose', 'copy', 'song', 'count']
const SEGMENT_FRESH_MS = 4000 // a segment older than this belongs to an earlier attempt
const RATED: Rung[] = ['sound', 'close', 'word']
const SOLO_STAR_EVERY = 8 // play-alone touches per star, so the jar can't be farmed

// Mic answer for this app session: "Yes" re-opens the mic silently next time, "Not now" stops asking.
let sessionMic: 'yes' | 'no' | null = null
let permission: PermissionState | 'unknown' = 'unknown'

type Attempt = Extract<LogRecord, { kind: 'attempt' }>

export function ActivityFrame(props: {
  activity: ActivityId
  settings: Settings
  photos?: Record<string, string>
  onExit: () => void
  onStar: () => void
  children: (api: FrameApi) => ReactNode
}) {
  const { activity, settings, photos = {} } = props
  const info = activityInfo(activity)
  const live = useRef({ settings, onStar: props.onStar, alive: true })
  live.current.settings = settings
  live.current.onStar = props.onStar

  const [, bump] = useReducer((n: number) => n + 1, 0)
  const [target, setTarget] = useState<Target | null>(null)
  const [celebrating, setCelebrating] = useState<Target | null>(null)
  const [chips, setChips] = useState<{ rung: Rung | null; leaving: boolean } | null>(null)
  const [pipFlash, setPipFlash] = useState(false)
  const [asking, setAsking] = useState(false)
  const answerMic = useRef<(() => void) | null>(null)
  const pendingLog = useRef<Attempt | null>(null)
  const timers = useRef<number[]>([])
  const encourage = useMemo(() => makePicker(ENCOURAGE_LINES), [])
  const soloTouches = useRef(0)

  const attemptRef = useRef<{ micState: string; requestMic(): Promise<void> } | null>(null)
  const runner = useMemo(
    () =>
      new TrialRunner({
        speak: (text) => speak(text, live.current.settings),
        sleep,
        micCard: {
          needed: () => attemptRef.current?.micState === 'off' && sessionMic === null && permission !== 'granted' && permission !== 'denied',
          ask: () =>
            new Promise<void>((resolve) => {
              answerMic.current = resolve
              setAsking(true)
            }),
        },
      }),
    [],
  )
  const waiting = runner.armed && runner.listening
  // Camera hints, parent opt-in only: a moving mouth eases the VAD bar; looking is logged, never required.
  const attention = useAttention({ enabled: settings.cameraEnabled, active: waiting })
  const looked = useRef(false)
  useEffect(() => {
    if (attention.looking && waiting) looked.current = true
  }, [attention.looking, waiting])

  const targetRef = useRef<Target | null>(null)
  const lastSeg = useRef<{ seg: Segment; target: Target; at: number } | null>(null)
  const rated = useRef<(Suggested & { target: string }) | null>(null)
  // Closeness runs once both the segment and the pending log record exist, whichever lands second.
  const applyCloseness = () => {
    const s = lastSeg.current
    const rec = pendingLog.current
    if (!s || !rec || rec.channel !== 'sound' || rec.rung || rec.suggested || s.target.id !== rec.target) return
    lastSeg.current = null
    if (performance.now() - s.at > SEGMENT_FRESH_MS) return
    const guess = suggest(s.seg, rec.target, s.target.spoken)
    rec.suggested = guess.suggested
    if (guess.closeness !== undefined) rec.closeness = guess.closeness
    rated.current = { ...guess, target: rec.target }
    setChips((c) => (c && c.rung === null ? { ...c, rung: guess.suggested } : c))
  }
  const onSegment = (seg: Segment) => {
    const t = targetRef.current
    recordHeard(seg, t?.id, live.current.settings.keepClips)
    if (seg.outcome.kind !== 'attempt' || !t) return
    lastSeg.current = { seg, target: t, at: performance.now() }
    applyCloseness()
  }

  const attempt = useAttempt({
    armed: runner.micOpen,
    micLevel: settings.micLevel,
    onAttempt: (c) => runner.attempt(c),
    onSegment,
    boost: attention.mouthMoved,
    parent: { voices: settings.parentVoices, pitches: settings.parentPitch, threshold: settings.parentThreshold },
  })
  attemptRef.current = attempt

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const flushLog = useCallback(() => {
    if (pendingLog.current) appendRecord(pendingLog.current)
    pendingLog.current = null
  }, [])

  useEffect(() => {
    const state = live.current
    state.alive = true
    runner.onChange = bump
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((p) => {
        permission = p.state
        if (state.alive && (p.state === 'granted' || sessionMic === 'yes')) void attemptRef.current?.requestMic()
      })
      .catch(() => {
        if (state.alive && sessionMic === 'yes') void attemptRef.current?.requestMic()
      })
    return () => {
      state.alive = false
      runner.onChange = () => {}
      runner.cancel()
      stopSpeaking()
      timers.current.forEach(clearTimeout)
      timers.current = []
      answerMic.current?.()
      flushLog()
    }
  }, [runner, flushLog])

  const runTrial = useCallback(
    async (t: Target, opts: TrialOptions = {}): Promise<TrialOutcome> => {
      setTarget(t)
      targetRef.current = t
      looked.current = false
      lastSeg.current = null
      rated.current = null
      const out = await runner.runTrial(t, opts)
      const state = live.current
      if (!state.alive) return NEVER
      const seen = looked.current ? { looked: true } : {}
      if (out.kind === 'sat') {
        appendRecord({ kind: 'sat', t: Date.now(), activity, target: t.id, ...seen })
        await runner.say(encourage().text)
        return out
      }
      const record: Attempt = { kind: 'attempt', t: Date.now(), activity, target: t.id, channel: out.channel, prompts: out.prompts, ...seen }
      if (opts.quiet || opts.solo) {
        appendRecord(record)
        setPipFlash(true)
        later(() => setPipFlash(false), 600)
        if (opts.solo) {
          // a touch already spoke its word; a sound gets the word back, softly, with no overlay
          if (out.channel === 'sound') void runner.say(`${t.spoken}!`)
          if (++soloTouches.current % SOLO_STAR_EVERY === 0) state.onStar()
        }
        return out
      }
      // Log now-ish: the parent has 3 s to add what the child did.
      flushLog()
      pendingLog.current = record
      setChips({ rung: null, leaving: false })
      applyCloseness()
      later(() => {
        flushLog()
        setChips((c) => c && { ...c, leaving: true })
        later(() => setChips(null), 200)
      }, CHIPS_MS)
      setCelebrating(t)
      state.onStar()
      await Promise.all([runner.say(`${t.shown}! yes!`), sleep(CELEBRATE_MS)])
      if (!state.alive) return NEVER
      setCelebrating(null)
      return { ...out, rung: (pendingLog.current ?? record).rung }
    },
    [runner, activity, encourage, flushLog],
  )

  const pickRung = (rung: Rung) => {
    const rec = pendingLog.current
    if (rec) {
      rec.rung = rung
      // The parent's rating picks this child's own template for the word.
      if (rated.current?.target === rec.target && RATED.includes(rung)) offerChildTemplate(rec.target, rung, rated.current.frames)
      flushLog()
    }
    setChips((c) => c && { ...c, rung })
  }

  const listening = waiting
  const pipMood: PipMood =
    celebrating || pipFlash ? 'delighted'
      : activity === 'uhoh' && runner.armed ? 'surprised'
        : activity === 'copy' ? 'thinking'
          : 'listening'

  const say = useCallback((text: string) => runner.say(text), [runner])
  const touch = useCallback(() => runner.attempt('touch'), [runner])
  const api: FrameApi = { runTrial, say, touch, listening, celebrating: !!celebrating, pipMood }

  const shown = celebrating ?? target
  const thing = shown ? (activeMotivators(settings).find((m) => m.id === shown.id)?.shown ?? shown.shown) : info.sample
  const tip = fillTip(celebrating ? info.celebrateTip : info.tip, {
    name: displayName(settings.childName),
    thing,
    word: shown?.shown ?? info.sample,
  })

  const answer = (yes: boolean) => {
    sessionMic = yes ? 'yes' : 'no'
    setAsking(false)
    if (yes) void attempt.requestMic()
    answerMic.current?.()
    answerMic.current = null
  }

  return (
    <div className={`frame hue-${info.hue} ${celebrating ? 'frame--celebrate' : ''} ${asking ? 'frame--asking' : ''}`}>
      <header className={`strip ${celebrating ? 'strip--celebrate' : ''}`}>
        <button type="button" className="icon-btn" aria-label="Exit activity" onClick={props.onExit}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--ink-2)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        <p aria-live="polite">{tip}</p>
      </header>

      <main className={`frame-stage ${PIP_CENTRE.includes(activity) ? 'frame-stage--centre' : ''}`} aria-hidden={asking}>
        {props.children(api)}
        {celebrating && <CelebrateOverlay target={celebrating} photo={photos[celebrating.id]} hue={info.hue} />}
      </main>

      <Pip
        mood={pipMood}
        size={celebrating ? 170 : undefined}
        waves={listening && attempt.micState === 'on'}
        className={`frame-pip ${PIP_CENTRE.includes(activity) ? 'frame-pip--centre' : ''} ${celebrating ? 'frame-pip--celebrate' : ''}`}
      />
      {!celebrating && !info.solo && (
        <HoldButton label="I saw it" hue={info.hue} className="frame-hold" onHold={() => runner.attempt('parent')} />
      )}
      {chips && <RungChips selected={chips.rung} leaving={chips.leaving} childName={displayName(settings.childName)} onPick={pickRung} />}
      {asking && <MicCard childName={settings.childName} onYes={() => answer(true)} onNo={() => answer(false)} />}
    </div>
  )
}
