// Verifies the engaging-practice features in a real browser:
//  - attention-grabbing "Say this" prompt with an easy syllable
//  - Zoom-style webcam toggle that hides the preview but keeps the video LIVE
//  - endless mode: it keeps going well past the old fixed session length
//
//   npm run dev   (in another terminal)
//   node tools/features-smoke.mjs [url] --chrome

import { chromium } from 'playwright'

const url = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:5173/'

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
const fail = (m) => {
  console.error(`\n❌ ${m}`)
  browser.close()
  process.exit(1)
}

console.log(`loading ${url} …`)
await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Start session/ }).click()

// 1. Attention-grabbing "Say this" + an easy short syllable.
await page.waitForSelector('.say-eyebrow', { timeout: 25000 }).catch(() => fail('no "Say this" eyebrow'))
const eyebrow = (await page.locator('.say-eyebrow').first().innerText()).trim().toLowerCase()
if (eyebrow !== 'say this') fail(`unexpected eyebrow text: "${eyebrow}"`)
const word = (await page.locator('.say-word').first().innerText()).trim()
if (word.length > 4) fail(`first target is not an easy short syllable: "${word}"`)
console.log(`  ✓ "Say this" prompt showing easy syllable: "${word}"`)

// 2. Webcam toggle hides the preview but keeps the <video> element live.
const toggle = page.getByRole('button', { name: /camera/i })
if (!(await toggle.isVisible().catch(() => false))) fail('no webcam toggle button')
await page.waitForSelector('.webcam-pip:not(.is-hidden)', { timeout: 8000 }).catch(() => fail('pip not visible initially'))
await toggle.click()
await page.waitForSelector('.webcam-pip.is-hidden', { timeout: 4000 }).catch(() => fail('pip did not hide on toggle'))
const videoLive = await page.evaluate(() => {
  const v = document.querySelector('.webcam-pip video')
  // Still in the DOM, not display:none → keeps decoding for the AI.
  return !!v && getComputedStyle(v).display !== 'none'
})
if (!videoLive) fail('video element was removed/hidden with display:none (AI would stop)')
console.log('  ✓ webcam toggle hides preview but keeps the video live for detection')

// 3. Endless mode: drive many trials via the caregiver button; never "All done".
let advanced = 0
for (let i = 0; i < 8; i += 1) {
  const sawBtn = page.getByRole('button', { name: /I saw it/ })
  if (await sawBtn.isVisible().catch(() => false)) {
    await sawBtn.click()
    advanced += 1
    await page.waitForTimeout(1600) // celebrate → next prompt
  } else {
    await page.waitForTimeout(1200)
  }
  const ended = await page.locator('text=All done').isVisible().catch(() => false)
  if (ended) fail(`session ended after ${advanced} trials — endless mode is off`)
}
console.log(`  ✓ endless mode: advanced ${advanced} trials with no "All done" screen`)

// 4. In-session level switch: clicking L2 restarts on the Level 2 word set.
const l2 = page.locator('.level-pill', { hasText: 'L2' })
if (!(await l2.isVisible().catch(() => false))) fail('no in-session level pills')
await l2.click()
await page.waitForSelector('.level-pill.active:has-text("L2")', { timeout: 6000 }).catch(() =>
  fail('Level 2 did not become active'),
)
await page.waitForSelector('.say-word', { timeout: 25000 }).catch(() => fail('no prompt after level switch'))
console.log('  ✓ in-session level switch to Level 2 works')

console.log('\n✅ verified: Say-this prompt · webcam toggle · endless mode · level switching')
await browser.close()
