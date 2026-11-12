// What happens to a voiced segment after the reward: the "what the mic heard" row, the optional
// clip, and the closeness guess for the rung chips. Never feeds back into whether a reward fires.
import { SAMPLE_RATE, type Segment } from '../engine/eval/engine'
import { closeness, templateFrames, voicedPart } from '../engine/eval/closeness'
import { writeWav } from '../engine/eval/wav'
import { addHeard, type Fired } from '../data/heard'
import { putClip } from '../data/clipStore'
import { loadLog, type Rung } from '../data/log'
import { templatesFor } from '../data/templates'

const CLIP_S = 5

export function recordHeard(seg: Segment, target: string | undefined, keepClips: boolean): void {
  const fired: Fired = seg.outcome.kind === 'parent' ? 'parent' : seg.outcome.channel === 'vad' ? 'voice' : 'energy'
  const id = Date.now()
  addHeard({ id, fired, target, clip: keepClips || undefined })
  if (keepClips) {
    const wav = writeWav({ sampleRate: SAMPLE_RATE, samples: seg.samples.subarray(0, CLIP_S * SAMPLE_RATE) })
    putClip(id, wav).catch((err) => console.warn('Could not keep the recording.', err))
  }
}

export interface Suggested {
  suggested: Rung
  closeness?: number
  frames: number[][] // MFCC of this attempt, kept in memory in case the parent rates it highest
}

/** The app's rung guess for an attempt at `target`, using this child's own past distances. */
export function suggest(seg: Segment, target: string, spoken: string): Suggested {
  const past = loadLog().flatMap((r) => (r.kind === 'attempt' && typeof r.closeness === 'number' ? [r.closeness] : []))
  const voiced = voicedPart(seg.samples)
  const result = closeness(voiced.length ? voiced : seg.samples, { target: spoken, templates: templatesFor(target), pastDistances: past })
  const d = result.features.distance
  return {
    suggested: result.suggestion,
    closeness: d === null ? undefined : Math.round(d * 1000) / 1000,
    frames: templateFrames(voiced.length ? voiced : seg.samples),
  }
}
