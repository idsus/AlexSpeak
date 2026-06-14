// Verifies the real-world photo pipeline end to end in a real browser:
// attach a photo to a target → it shows on the target screen instead of the
// emoji → it survives a full page reload (IndexedDB persistence).
//
//   npm run dev   (in another terminal)
//   node tools/images-smoke.mjs [url] --chrome

import { chromium } from 'playwright'

const url = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:5173/'
const messages = []

// A small but real PNG (red 2x2) so createImageBitmap/canvas can decode it.
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DAwMDAwAAADAEBAvJ0nFsAAAAASUVORK5CYII='
const pngBuffer = Buffer.from(pngBase64, 'base64')

const browser = await chromium.launch({
  channel: process.argv.includes('--chrome') ? 'chrome' : undefined,
  args: [
    '--use-fake-ui-for-media-streams',
    '--use-fake-device-for-media-streams',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const context = await browser.newContext({ permissions: ['microphone', 'camera'] })
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') messages.push(`[console.error] ${m.text()}`)
})
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`))

const fail = (msg) => {
  console.error(`\n❌ ${msg}`)
  browser.close()
  process.exit(1)
}

console.log(`loading ${url} …`)
await page.goto(url, { waitUntil: 'networkidle' })

// 1. Attach a real photo to the "ma" target in settings.
console.log('opening settings and attaching a photo to "ma" …')
await page.getByRole('button', { name: /Caregiver settings/ }).click()
await page.setInputFiles('input[data-photo-input="ma"]', {
  name: 'real-ma.png',
  mimeType: 'image/png',
  buffer: pngBuffer,
})
await page.waitForSelector('.photo-item:has(strong:text-is("ma")) img', { timeout: 10000 })
console.log('  ✓ thumbnail rendered in settings')
await page.getByRole('button', { name: /^Save$/ }).click()

// 2. Start a session; the ma target should now show the photo, not the emoji.
console.log('starting a session and checking the target screen …')
await page.getByRole('button', { name: /Start session/ }).click()
const photo = await page.waitForSelector('img.target-photo', { timeout: 25000 }).catch(() => null)
if (!photo) fail('target photo did not appear on the prompt screen')
const src = await photo.getAttribute('src')
if (!src || !src.startsWith('data:image/jpeg')) fail(`target photo src is not a stored JPEG: ${src?.slice(0, 32)}`)
const emojiVisible = await page.locator('.target-emoji').isVisible().catch(() => false)
if (emojiVisible) fail('emoji is still showing even though a photo is attached')
console.log('  ✓ real photo shown on target screen (emoji replaced)')

// 3. Reload the whole page and confirm the photo persisted (IndexedDB).
console.log('reloading to verify persistence …')
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Start session/ }).click()
const photoAfter = await page.waitForSelector('img.target-photo', { timeout: 25000 }).catch(() => null)
if (!photoAfter) fail('target photo did not persist across reload')
console.log('  ✓ photo persisted across a full reload')

const errors = [...new Set(messages)].filter(
  (m) => !m.includes('XNNPACK') && !m.includes('clips/'),
)
console.log(`\nconsole errors (filtered): ${errors.length ? '\n' + errors.join('\n') : '(none)'}`)
console.log('\n✅ real-world photo pipeline verified: attach → display → persist')
await browser.close()
