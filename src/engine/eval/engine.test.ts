/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AttemptEngine, FRAME_SIZE, type Attempt } from './engine.ts'
import { readWav } from './wav.ts'

function replayEnergyOnly(file: string): { attempts: Attempt[]; times: number[] } {
  const { samples } = readWav(new Uint8Array(readFileSync(`fixtures/engine/${file}`)))
  const engine = new AttemptEngine({ sensitivity: 32, noiseRejection: 45 })
  engine.resume()
  const attempts: Attempt[] = []
  const times: number[] = []
  for (let at = 0; at + FRAME_SIZE <= samples.length; at += FRAME_SIZE) {
    const hit = engine.push(samples.subarray(at, at + FRAME_SIZE))
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
