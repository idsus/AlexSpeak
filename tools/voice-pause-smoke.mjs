// Verifies: server voice (/api/tts) is used, the coach line is the new
// sound-focused enthusiastic format (no filler), and pause/resume works.
import { chromium } from 'playwright'

const url = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:5173/'
const browser = await chromium.launch({
  channel: process.argv.includes('--chrome') ? 'chrome' : undefined,
  args: ['--use-fake-ui-for-media-streams', '--use-fake-device-for-media-streams', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({ permissions: ['microphone', 'camera'] })
const page = await ctx.newPage()
let ttsHit = false
page.on('request', (r) => { if (r.url().includes('/api/tts')) ttsHit = true })
const fail = (m) => { console.error(`\n❌ ${m}`); browser.close(); process.exit(1) }

await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Start session/ }).click()
await page.waitForSelector('.coach-bubble', { timeout: 25000 })
await page.waitForTimeout(1500)
const coach = (await page.locator('.coach-bubble').first().innerText()).trim()
console.log('coach line:', JSON.stringify(coach))
if (/your turn|try a|listen|alex,/i.test(coach)) fail(`coach line still has filler: ${coach}`)
if (!coach.includes('!')) fail('coach line is not enthusiastic (no "!")')

// Server voice should have been requested.
await page.waitForTimeout(2500)
if (!ttsHit) fail('/api/tts was never requested (server voice not used)')
console.log('  ✓ server voice (/api/tts) used; coach line is sound-focused + enthusiastic')

// Pause / resume.
const pauseBtn = page.getByRole('button', { name: /Pause/ })
if (!(await pauseBtn.isVisible().catch(() => false))) fail('no Pause button during the trial')
await pauseBtn.click()
await page.waitForSelector('.pause-overlay', { timeout: 4000 }).catch(() => fail('pause overlay did not appear'))
await page.getByRole('button', { name: /Resume/ }).click()
await page.waitForSelector('.pause-overlay', { state: 'detached', timeout: 4000 }).catch(() => fail('did not resume'))
await page.waitForSelector('.coach-bubble', { timeout: 25000 })
console.log('  ✓ pause shows overlay; resume returns to the trial')

// Level 0 letter pronunciation (y -> "Why! Whyyy!").
await page.locator('.level-pill', { hasText: 'L0' }).click()
await page.waitForTimeout(2500)
let foundLetter = false
for (let i = 0; i < 6; i += 1) {
  const c = (await page.locator('.coach-bubble').first().innerText().catch(() => '')).trim()
  if (/y{3,}|[a-z]{1}\w*y{3,}|aaa|eee|ohh/i.test(c)) { foundLetter = true; console.log('  level 0 coach line:', JSON.stringify(c)); break }
  const saw = page.getByRole('button', { name: /I saw it/ })
  if (await saw.isVisible().catch(() => false)) { await saw.click(); await page.waitForTimeout(1500) } else { await page.waitForTimeout(1000) }
}
if (!foundLetter) console.log('  (level 0 elongation not asserted this run — letters cycle)')
console.log('\n✅ voice + coaching + pause verified')
await browser.close()
