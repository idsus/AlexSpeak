import { describe, expect, it } from 'vitest'
import { AttentionTracker, poseFromMatrix } from './attention'

const face = (t: number, over: Partial<{ yaw: number; pitch: number; jawOpen: number }> = {}) => ({
  t, face: true, yaw: 0, pitch: 0, jawOpen: 0.05, ...over,
})

describe('AttentionTracker', () => {
  it('turns looking on and off only after ~300 ms', () => {
    const a = new AttentionTracker()
    expect(a.push(face(0)).looking).toBe(false)
    expect(a.push(face(200)).looking).toBe(false)
    expect(a.push(face(300)).looking).toBe(true)
    // A brief glance away does not flip it.
    expect(a.push(face(400, { yaw: 40 })).looking).toBe(true)
    expect(a.push(face(500)).looking).toBe(true)
    expect(a.push(face(600, { yaw: 40 })).looking).toBe(true)
    expect(a.push(face(800, { pitch: -30 })).looking).toBe(true)
    expect(a.push(face(900, { yaw: 40 })).looking).toBe(false)
  })

  it('fires mouthMoved on an open-close, not on a steady open mouth', () => {
    const a = new AttentionTracker()
    expect(a.push(face(0, { jawOpen: 0.05 })).mouthMoved).toBe(false)
    expect(a.push(face(100, { jawOpen: 0.4 })).mouthMoved).toBe(true)
    expect(a.push(face(200, { jawOpen: 0.05 })).mouthMoved).toBe(true)
    // Out of the 600 ms window again.
    let last = a.push(face(900, { jawOpen: 0.05 }))
    expect(last.mouthMoved).toBe(false)

    const b = new AttentionTracker()
    for (let t = 0; t <= 2000; t += 100) last = b.push(face(t, { jawOpen: 0.5 + (t % 200 ? 0.02 : 0) }))
    expect(last.mouthMoved).toBe(false)
    expect(last.mouthOpen).toBeGreaterThan(0.45)
  })

  it('reports nothing without a face', () => {
    const a = new AttentionTracker()
    for (let t = 0; t <= 1000; t += 100) a.push(face(t, { jawOpen: t % 200 ? 0.6 : 0 }))
    let last = a.push({ t: 1100, face: false, yaw: 0, pitch: 0, jawOpen: 0.6 })
    expect(last.mouthMoved).toBe(false)
    expect(last.mouthOpen).toBe(0)
    for (let t = 1200; t <= 1500; t += 100) last = a.push({ t, face: false, yaw: 0, pitch: 0, jawOpen: 0.9 })
    expect(last).toEqual({ looking: false, mouthMoved: false, mouthOpen: 0 })
  })
})

describe('poseFromMatrix', () => {
  it('reads yaw and pitch from a column-major rotation', () => {
    const a = (30 * Math.PI) / 180
    // Rotation about Y by 30°, column-major.
    const ry = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, -40, 1]
    expect(poseFromMatrix(ry).yaw).toBeCloseTo(30)
    expect(poseFromMatrix(ry).pitch).toBeCloseTo(0)
    // Rotation about X by 30°.
    const rx = [1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, -40, 1]
    expect(poseFromMatrix(rx).pitch).toBeCloseTo(30)
    expect(poseFromMatrix(rx).yaw).toBeCloseTo(0)
  })
})
