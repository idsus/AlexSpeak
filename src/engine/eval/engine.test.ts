/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AttemptEngine, FRAME_SIZE, type Attempt, type Outcome, type Segment } from './engine.ts'
import { makeParentVeto } from './speaker.ts'
import { readWav } from './wav.ts'

function replayEnergyOnly(file: string): { attempts: Attempt[]; times: number[] } {
  const { samples } = readWav(new Uint8Array(readFileSync(`fixtures/engine/${file}`)))
  const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45 })
  engine.resume()
  const attempts: Attempt[] = []
  const times: number[] = []
  for (let at = 0; at + FRAME_SIZE <= samples.length; at += FRAME_SIZE) {
    const hit = engine.push(samples.subarray(at, at + FRAME_SIZE)) as Attempt | null
    times.push(engine.t)
    if (hit) attempts.push(hit)
  }
  return { attempts, times }
}

describe('AttemptEngine (energy only)', () => {
  it('fires on a -30 dBFS voiced proxy within 300 ms of each onset', () => {
    const { attempts } = replayEnergyOnly('child-harmonic-30.wav')
    for (const onset of [1.0, 3.0]) {
      const hit = attempts.find((a) => a.t >= onset && a.t <= onset + 0.3)
      expect(hit, `attempt near ${onset}s`).toMatchObject({ channel: 'energy' })
    }
  })

  it('stays quiet on silence and on -30 dBFS white noise', () => {
    expect(replayEnergyOnly('silence.wav').attempts).toEqual([])
    expect(replayEnergyOnly('white-30.wav').attempts).toEqual([])
  })

  it('keeps a monotonic clock driven by samples pushed', () => {
    const { times } = replayEnergyOnly('silence.wav')
    expect(times[0]).toBe(FRAME_SIZE / 16000)
    for (let i = 1; i < times.length; i += 1) expect(times[i]).toBeGreaterThan(times[i - 1])
  })

  it('needs two voiced VAD frames and then respects the cooldown', () => {
    const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45 })
    engine.resume()
    const quiet = new Float32Array(FRAME_SIZE)
    expect(engine.push(quiet, 0.9)).toBeNull()
    expect(engine.push(quiet, 0.9)).toMatchObject({ channel: 'vad' })
    expect(engine.push(quiet, 0.9)).toBeNull()
    expect(engine.push(quiet, 0.9)).toBeNull()
  })
})

describe('AttemptEngine parent veto', () => {
  const parent = [1, 0, 0]
  const voiced = new Float32Array(FRAME_SIZE)
  async function run(embedding: number[] | null) {
    const segments: Segment[] = []
    const veto = embedding ? makeParentVeto(async () => Float32Array.from(embedding), [parent], [0], 0.45) : null
    const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45, veto, onSegment: (s) => segments.push(s) })
    engine.resume()
    const results: { frame: number; sync: boolean; outcome: Outcome }[] = []
    for (let i = 0; i < 40; i += 1) {
      const r = engine.push(voiced, i < 20 ? 0.9 : 0)
      if (r) results.push({ frame: i, sync: !(r instanceof Promise), outcome: await r })
    }
    await Promise.resolve()
    return { results, segments }
  }

  it('drops a voice that matches the enrolled parent', async () => {
    const { results, segments } = await run(parent)
    expect(results).toHaveLength(1)
    expect(results[0].outcome).toMatchObject({ kind: 'parent', channel: 'vad' })
    expect(segments[0].outcome.kind).toBe('parent')
  })

  it('fires for any other voice once 400 ms is buffered', async () => {
    const { results } = await run([0, 1, 0])
    expect(results).toHaveLength(1)
    expect(results[0].outcome).toMatchObject({ kind: 'attempt', channel: 'vad' })
    expect(results[0].frame).toBe(12) // 13 voiced frames x 32 ms ≥ 400 ms
  })

  it('without an enrolled parent fires synchronously on the second VAD frame, as in Phase A', async () => {
    const { results, segments } = await run(null)
    expect(results[0]).toMatchObject({ frame: 1, sync: true, outcome: { kind: 'attempt', t: (2 * FRAME_SIZE) / 16000 } })
    expect(segments[0].samples.length).toBeGreaterThan(19 * FRAME_SIZE)
  })

  it('falls back to rewarding when the speaker model fails', async () => {
    const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45, veto: async () => { throw new Error('boom') } })
    engine.resume()
    const outs: Outcome[] = []
    for (let i = 0; i < 20; i += 1) {
      const r = engine.push(voiced, 0.9)
      if (r) outs.push(await r)
    }
    expect(outs[0]).toMatchObject({ kind: 'attempt' })
  })

  it('boost lowers the VAD threshold so a borderline frame counts', () => {
    const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45 })
    engine.resume()
    expect(engine.push(voiced, 0.25)).toBeNull()
    expect(engine.push(voiced, 0.25)).toBeNull()
    engine.setBoost(true)
    expect(engine.push(voiced, 0.25)).toBeNull()
    expect(engine.push(voiced, 0.25)).toMatchObject({ kind: 'attempt', channel: 'vad' })
  })
})
