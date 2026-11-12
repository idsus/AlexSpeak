import { useCallback, useEffect, useRef } from 'react'
import type { Target } from '../data/content'
import type { FrameApi } from './ActivityFrame'

export const SOLO = { say: false, solo: true } as const

// Every solo trial re-arms itself when it lands, so the mic (only if already on) keeps listening between touches.
// A new trial cancels the old one, whose promise never resolves, so exactly one loop is ever running.
function arm(api: { current: FrameApi }, t: Target): void {
  void api.current.runTrial(t, SOLO).then(() => arm(api, t))
}

/**
 * Play-alone touches: tap(word) logs a touch and speaks the word at once. No timer, no re-model, no 'sat',
 * nothing for an adult to confirm. `first` is what a sound counts as before the first touch.
 */
export function useSolo(api: FrameApi, first: Target): (word: Target) => void {
  const ref = useRef(api)
  ref.current = api
  const firstRef = useRef(first)
  useEffect(() => {
    const start = setTimeout(() => arm(ref, firstRef.current), 0) // deferred: StrictMode mounts twice
    return () => clearTimeout(start)
  }, [])
  return useCallback((word: Target) => {
    arm(ref, word) // arms synchronously, so the touch below resolves it at once
    ref.current.touch()
    void ref.current.say(word.spoken)
  }, [])
}
