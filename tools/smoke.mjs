// Headless smoke test: loads the app with fake mic/camera, starts a session,
// and reports every console error / page error it sees along the way.
//
//   npm run dev          (in another terminal)
//   node tools/smoke.mjs [url]

import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5174/'
const messages = []

const browser = await chromium.launch({
  // --chrome uses the installed Chrome (real WebGL etc.) instead of the
  // headless shell, which lacks the GPU features MediaPipe needs.
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
  if (m.type() === 'error' || m.type() === 'warning') {
    messages.push(`[console.${m.type()}] ${m.text()}`)
  }
})
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) =>
  messages.push(`[requestfailed] ${r.url()} — ${r.failure()?.errorText}`),
)

console.log(`loading ${url} …`)
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log('--- home screen text ---')
console.log(await page.evaluate(() => document.body.innerText))

console.log('\npressing Start …')
await page.getByRole('button', { name: /Start/ }).click()
await page.waitForTimeout(12000)

console.log('--- session screen text (after 12 s) ---')
console.log(await page.evaluate(() => document.body.innerText))
await page.screenshot({ path: 'tools/smoke-session.png' })

console.log('\npressing "I saw it!" if visible …')
const caregiver = page.getByRole('button', { name: /I saw it/ })
if (await caregiver.isVisible().catch(() => false)) {
  await caregiver.click()
  await page.waitForTimeout(3000)
  console.log('--- after caregiver tap ---')
  console.log(await page.evaluate(() => document.body.innerText))
}
await page.screenshot({ path: 'tools/smoke-celebrate.png' })

console.log('\n=== console/page errors (deduped) ===')
const unique = [...new Set(messages)]
console.log(unique.length ? unique.join('\n') : '(none)')

await browser.close()
