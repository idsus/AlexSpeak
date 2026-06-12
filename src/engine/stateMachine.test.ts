import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  reduce,
  type EngineState,
  type SessionConfig,
} from './stateMachine'

const config: SessionConfig = {
  words: ['apple', 'ball'],
  maxReprompts: 2,
  trialsPerSession: 3,
}

function run(state: EngineState, ...events: Parameters<typeof reduce>[2][]) {
  return events.reduce((s, e) => reduce(s, config, e), state)
}

describe('state machine', () => {
  it('starts idle', () => {
    expect(createInitialState().phase).toBe('idle')
  })

  it('START_SESSION begins the first prompt with counters reset', () => {
    const s = run(createInitialState(), { type: 'START_SESSION' })
    expect(s).toMatchObject({
      phase: 'prompt',
      wordIndex: 0,
      trialIndex: 0,
      repromptCount: 0,
      successCount: 0,
    })
  })

  it('PROMPT_ENDED opens the listen window', () => {
    const s = run(createInitialState(), { type: 'START_SESSION' }, { type: 'PROMPT_ENDED' })
    expect(s.phase).toBe('listen')
  })

  it('an attempt during listen celebrates and records the channel', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'ATTEMPT', channel: 'audio' },
    )
    expect(s.phase).toBe('celebrate')
    expect(s.lastChannel).toBe('audio')
    expect(s.successCount).toBe(1)
  })

  it('attempts during prompt or model also celebrate (never miss an attempt)', () => {
    const duringPrompt = run(createInitialState(), { type: 'START_SESSION' }, { type: 'ATTEMPT', channel: 'manual' })
    expect(duringPrompt.phase).toBe('celebrate')

    const duringModel = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
      { type: 'ATTEMPT', channel: 'mouth' },
    )
    expect(duringModel.phase).toBe('celebrate')
    expect(duringModel.lastChannel).toBe('mouth')
  })

  it('listen timeout under the cap re-models the word', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
    )
    expect(s.phase).toBe('model')
    expect(s.repromptCount).toBe(1)
  })

  it('MODEL_ENDED re-opens the listen window', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
      { type: 'MODEL_ENDED' },
    )
    expect(s.phase).toBe('listen')
  })

  it('after maxReprompts it eases off into encourage, not another retry', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'LISTEN_TIMEOUT' }, // reprompt 1
      { type: 'MODEL_ENDED' },
      { type: 'LISTEN_TIMEOUT' }, // reprompt 2 (cap)
      { type: 'MODEL_ENDED' },
      { type: 'LISTEN_TIMEOUT' }, // cap reached → encourage
    )
    expect(s.phase).toBe('encourage')
  })

  it('CELEBRATE_DONE advances to the next trial with the next word', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'ATTEMPT', channel: 'audio' },
      { type: 'CELEBRATE_DONE' },
    )
    expect(s).toMatchObject({ phase: 'prompt', wordIndex: 1, trialIndex: 1, repromptCount: 0 })
  })

  it('words wrap around when there are more trials than words', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' }, // trial 2, word 'ball'
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' }, // trial 3, wraps to 'apple'
    )
    expect(s.wordIndex).toBe(0)
    expect(s.trialIndex).toBe(2)
  })

  it('the session ends after trialsPerSession trials', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
    )
    expect(s.phase).toBe('sessionEnd')
    expect(s.successCount).toBe(3)
  })

  it('ENCOURAGE_DONE moves on without counting a success', () => {
    const s = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'PROMPT_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
      { type: 'MODEL_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
      { type: 'MODEL_ENDED' },
      { type: 'LISTEN_TIMEOUT' },
      { type: 'ENCOURAGE_DONE' },
    )
    expect(s).toMatchObject({ phase: 'prompt', trialIndex: 1, successCount: 0 })
  })

  it('STOP returns to idle from any phase', () => {
    const s = run(createInitialState(), { type: 'START_SESSION' }, { type: 'PROMPT_ENDED' }, { type: 'STOP' })
    expect(s.phase).toBe('idle')
  })

  it('DISMISS leaves the session-end screen', () => {
    const end = run(
      createInitialState(),
      { type: 'START_SESSION' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
      { type: 'ATTEMPT', channel: 'manual' },
      { type: 'CELEBRATE_DONE' },
    )
    expect(run(end, { type: 'DISMISS' }).phase).toBe('idle')
  })

  it('ignores events that make no sense for the current phase', () => {
    const idle = createInitialState()
    expect(run(idle, { type: 'ATTEMPT', channel: 'audio' })).toEqual(idle)
    expect(run(idle, { type: 'LISTEN_TIMEOUT' })).toEqual(idle)
  })
})
