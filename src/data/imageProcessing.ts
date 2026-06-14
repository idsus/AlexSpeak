// Helpers for turning a chosen real-world photo into a small, storable image.
// The pure functions (no DOM) are unit-tested; the browser resize uses canvas.

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]

const MAX_IMAGE_DIM = 720
const JPEG_QUALITY = 0.82

export function isSupportedImageType(type: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(type)
}

/**
 * Scale (width, height) to fit within `maxDim` on the longest edge, preserving
 * aspect ratio and never upscaling. Pure — safe to unit-test.
 */
export function fitDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 }
  }
  const longest = Math.max(width, height)
  if (longest <= maxDim) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const scale = maxDim / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Approximate decoded byte size of a data URL — used for quota-friendliness. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const base64 = dataUrl.slice(comma + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Some formats (or Safari) fail createImageBitmap — fall back to <img>.
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

/**
 * Read a user-chosen image file, downscale it, and return a compact JPEG data
 * URL suitable for offline IndexedDB storage. Throws on unsupported or
 * unreadable files so the caller can show a clear message.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = MAX_IMAGE_DIM,
): Promise<string> {
  if (!isSupportedImageType(file.type)) {
    throw new Error('Please choose a JP, PNG, WEBP, GIF, or BMP image')
  }
  const source = await loadImage(file)
  const sourceWidth =
    (source as HTMLImageElement).naturalWidth || (source as ImageBitmap).width
  const sourceHeight =
    (source as HTMLImageElement).naturalHeight || (source as ImageBitmap).height
  const { width, height } = fitDimensions(sourceWidth, sourceHeight, maxDim)
  if (width === 0 || height === 0) {
    throw new Error('That image looked empty')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This device cannot process images')
  ctx.drawImage(source, 0, 0, width, height)
  if ('close' in source && typeof source.close === 'function') source.close()
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
