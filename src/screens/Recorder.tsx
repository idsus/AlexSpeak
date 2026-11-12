import { useEffect, useRef, useState } from 'react'
import { HoldRing, holdStyle } from '../ui/HoldButton'
import { recordClip } from '../audio/vadChannel'
import { templateFrames, voicedPart } from '../engine/eval/closeness'
import { loadTemplates, saveParentTemplate } from '../data/templates'

/** A fixed-length recording with the hold ring as its progress. Returns null if it was cut short by unmounting. */
export function useRecorder() {
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const record = async (seconds: number): Promise<Float32Array | null> => {
    const ctl = new AbortController()
    abort.current = ctl
    setBusy(true)
    try {
      const clip = await recordClip(seconds, (f) => setStep(Math.min(2, Math.floor(f * 3))), ctl.signal)
      return ctl.signal.aborted ? null : clip
    } finally {
      setBusy(false)
      setStep(0)
    }
  }
  return { busy, step, record }
}

/** The 40 px hold ring filling over the recording; Calm mode shows it in thirds. */
export function RecRing(props: { busy: boolean; step: number; seconds: number }) {
  return (
    <span className={props.busy ? `hold--on hold--s${props.step}` : ''} style={holdStyle(props.seconds * 1000, 'var(--hue-song-deep)')}>
      <HoldRing>
        <svg width="40" height="40" viewBox="0 0 40 40" className="hold-check" aria-hidden="true">
          <rect x="16" y="11" width="8" height="13" rx="4" fill="var(--ink-2)" />
          <path d="M13 20a7 7 0 0 0 14 0M20 27v3" fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </HoldRing>
    </span>
  )
}

const WORD_S = 2.5
const MIN_WORD_SAMPLES = 1600 // 100 ms of voice

/** "Record this word": the parent says it once; only its MFCC frames are kept, as a closeness template. */
export function RecordWord({ word, compact = false }: { word: string; compact?: boolean }) {
  const rec = useRecorder()
  const [saved, setSaved] = useState(() => !!loadTemplates()[word]?.parent)
  const [msg, setMsg] = useState('')

  const go = async () => {
    setMsg('')
    try {
      const clip = await rec.record(WORD_S)
      if (!clip) return
      const voiced = voicedPart(clip)
      if (voiced.length < MIN_WORD_SAMPLES) return setMsg('No word heard. Tap and say it a little louder.')
      saveParentTemplate(word, templateFrames(voiced))
      setSaved(true)
    } catch {
      setMsg('The microphone is not available.')
    }
  }

  return (
    <span className={compact ? 'pa-rec-word pa-rec-word--compact' : 'pa-rec-word'}>
      <button
        type="button"
        className={compact ? 'pa-rec-icon' : 'parent-btn'}
        disabled={rec.busy}
        onClick={() => void go()}
        aria-label={compact ? `${saved ? 'Record again' : 'Record yourself saying'}: ${word}` : undefined}
        title={compact ? `Record yourself saying “${word}”` : undefined}
      >
        <RecRing busy={rec.busy} step={rec.step} seconds={WORD_S} />
        {!compact && (rec.busy ? `say “${word}”` : saved ? `“${word}” recorded` : `record “${word}”`)}
      </button>
      {msg && <span className="pa-note" role="status">{msg}</span>}
    </span>
  )
}
