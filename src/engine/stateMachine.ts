// Pure state machine for the PROMPT → LISTEN → CELEBRATE / MODEL loop.
// No timers, no audio, no React — the App component owns side effects and
// feeds events in. That keeps every transition unit-testable.

export type Phase =
  | 'idle'
  | 'prompt'
  | 'listen'
  | 'celebrate'
  | 'model'
  | 'encourage'
  | 'sessionEnd'

export type Channel = 'audio' | 'mouth' | 'manual'

export interface SessionConfig {
  words: string[]
  maxReprompts: number
  trialsPerSession: number
  /** When true the session never auto-ends — it cycles the word list until Stop. */
  endless?: boolean
}

export interface EngineState {
  phase: Phase
  wordIndex: number
  trialIndex: number
  repromptCount: number
  successCount: number
  lastChannel: Channel | null
}

export type EngineEvent =
  | { type: 'START_SESSION' }
  | { type: 'PROMPT_ENDED' }
  | { type: 'ATTEMPT'; channel: Channel }
  | { type: 'LISTEN_TIMEOUT' }
  | { type: 'MODEL_ENDED' }
  | { type: 'CELEBRATE_DONE' }
  | { type: 'ENCOURAGE_DONE' }
  | { type: 'STOP' }
  | { type: 'DISMISS' }

export function createInitialState(): EngineState {
  return {
    phase: 'idle',
    wordIndex: 0,
    trialIndex: 0,
    repromptCount: 0,
    successCount: 0,
    lastChannel: null,
  }
}

function nextTrial(state: EngineState, config: SessionConfig): EngineState {
  const trialIndex = state.trialIndex + 1
  // Endless mode goes on and on — only the Stop button ends it.
  if (!config.endless && trialIndex >= config.trialsPerSession) {
    return { ...state, phase: 'sessionEnd', trialIndex }
  }
  return {
    ...state,
    phase: 'prompt',
    trialIndex,
    wordIndex: (state.wordIndex + 1) % config.words.length,
    repromptCount: 0,
    lastChannel: null,
  }
}

export function reduce(
  state: EngineState,
  config: SessionConfig,
  event: EngineEvent,
): EngineState {
  if (event.type === 'STOP') {
    return { ...createInitialState() }
  }

  switch (state.phase) {
    case 'idle':
      if (event.type === 'START_SESSION') {
        return { ...createInitialState(), phase: 'prompt' }
      }
      return state

    case 'prompt':
    case 'listen':
    case 'model':
      // An attempt counts no matter which of these sub-phases it lands in —
      // the caregiver button or mouth channel can fire while a clip is
      // still playing, and that effort must never be dropped.
      if (event.type === 'ATTEMPT') {
        return {
          ...state,
          phase: 'celebrate',
          lastChannel: event.channel,
          successCount: state.successCount + 1,
        }
      }
      if (state.phase === 'prompt' && event.type === 'PROMPT_ENDED') {
        return { ...state, phase: 'listen' }
      }
      if (state.phase === 'listen' && event.type === 'LISTEN_TIMEOUT') {
        if (state.repromptCount < config.maxReprompts) {
          return { ...state, phase: 'model', repromptCount: state.repromptCount + 1 }
        }
        return { ...state, phase: 'encourage' }
      }
      if (state.phase === 'model' && event.type === 'MODEL_ENDED') {
        return { ...state, phase: 'listen' }
      }
      return state

    case 'celebrate':
      if (event.type === 'CELEBRATE_DONE') {
        return nextTrial(state, config)
      }
      return state

    case 'encourage':
      if (event.type === 'ENCOURAGE_DONE') {
        return nextTrial(state, config)
      }
      return state

    case 'sessionEnd':
      if (event.type === 'DISMISS') {
        return createInitialState()
      }
      if (event.type === 'START_SESSION') {
        return { ...createInitialState(), phase: 'prompt' }
      }
      return state
  }
}
