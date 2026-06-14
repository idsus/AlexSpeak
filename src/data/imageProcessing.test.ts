import { describe, it, expect } from 'vitest'
import { fitDimensions, isSupportedImageType, estimateDataUrlBytes } from './imageProcessing'

describe('fitDimensions', () => {
  it('never upscales a small image', () => {
    expect(fitDimensions(300, 200, 720)).toEqual({ width: 300, height: 200 })
  })

  it('scales a large landscape image to fit the longest edge', () => {
    expect(fitDimensions(1440, 720, 720)).toEqual({ width: 720, height: 360 })
  })

  it('scales a large portrait image by its height', () => {
    expect(fitDimensions(720, 1440, 720)).toEqual({ width: 360, height: 720 })
  })

  it('preserves aspect ratio within rounding', () => {
    const { width, height } = fitDimensions(4000, 3000, 720)
    expect(width).toBe(720)
    expect(height).toBe(540)
  })

  it('returns zero for degenerate or invalid sizes', () => {
    expect(fitDimensions(0, 100, 720)).toEqual({ width: 0, height: 0 })
    expect(fitDimensions(Number.NaN, 100, 720)).toEqual({ width: 0, height: 0 })
  })
})

describe('isSupportedImageType', () => {
  it('accepts common photo formats', () => {
    expect(isSupportedImageType('image/jpeg')).toBe(true)
    expect(isSupportedImageType('image/png')).toBe(true)
    expect(isSupportedImageType('image/webp')).toBe(true)
  })

  it('rejects non-images', () => {
    expect(isSupportedImageType('application/pdf')).toBe(false)
    expect(isSupportedImageType('')).toBe(false)
  })
})

describe('estimateDataUrlBytes', () => {
  it('estimates decoded size from a base64 data URL', () => {
    // "hi" → "aGk=" (3 base64 chars + 1 pad) decodes to 2 bytes.
    expect(estimateDataUrlBytes('data:text/plain;base64,aGk=')).toBe(2)
  })

  it('returns 0 for a non-data string', () => {
    expect(estimateDataUrlBytes('not a data url')).toBe(0)
  })
})
