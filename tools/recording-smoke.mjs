// Verifies the personalized voice (recording) model loads its base model from
// the LOCAL bundle, not the Google CDN — so recording works fully offline and
// on a static GitHub Pages deploy.
//
//   npm run dev   (in another terminal)
//   node tools/recording-smoke.mjs [url] --chrome

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

let localModelHit = false
let cdnModelHit = false
const notices = []
page.on('request', (r) => {
  const u = r.url()
  if (u.includes('/models/speech-commands/model.json')) localModelHit = true
  if (u.includes('storage.googleapis.com') && u.includes('speech-commands')) cdnModelHit = true
})
page.on('console', (m) => {
  if (/personal|speech|model/i.test(m.text())) notices.push(`[${m.type()}] ${m.text()}`)
})

const fail = (m) => {
  console.error(`\n❌ ${m}`)
  if (notices.length) console.error('captured console:\n' + notices.slice(-12).join('\n'))
  browser.close()
  process.exit(1)
}

console.log(`loading ${url} …`)
await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Start session/ }).click()
// Give the personalized model time to initialize during the session.
await page.waitForTimeout(8000)

// The "Personal voice model unavailable" notice must NOT appear.
const unavailable = await page.locator('text=Personal voice model unavailable').isVisible().catch(() => false)

console.log(`  local base model requested:  ${localModelHit}`)
console.log(`  Google CDN model requested:  ${cdnModelHit}`)
console.log(`  "unavailable" notice shown:  ${unavailable}`)

if (cdnModelHit) fail('recording model still fetched from the Google CDN (not offline)')
if (!localModelHit) fail('local speech-commands base model was never requested')
if (unavailable) fail('personal voice model reported unavailable')

console.log('\n✅ recording model loads locally — works offline / on a static deploy')
await browser.close()
