# AlexSpeak Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single say-the-word loop with nine tap-to-start activities, a companion, a star garden, and a plain-words parent area, matching the approved canvas.

**Architecture:** A view switch in `App.tsx` (home | activity | parent). Every activity is a component rendered inside `ActivityFrame`, which owns the parent strip, the listen/celebrate cycle, logging and Pip; activities own only their scene and call `frame.runTrial(target)`. Data is three small localStorage modules (settings, log, garden) and the kept IndexedDB photo store.

**Tech Stack:** React 19, Vite 8, TypeScript, vitest, `@fontsource-variable/nunito`, Web Speech via the kept `playClip.ts`, mic via the kept `useAudioEffort.ts`, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-10-31-alexspeak-revamp-design.md` (+ its 2026-11-01 additions), `PRODUCT.md`, `DESIGN.md`, canvas https://claude.ai/artifact/9FymQdjmXTkJHXRpR6MpgA.

## Global Constraints

- 100 % offline at runtime: no network calls, no Google Fonts link, font bundled via `@fontsource-variable/nunito`.
- No pass/fail anywhere: no `success: false`, no "wrong", no red X; timeouts log as `sat`.
- Child-facing text lowercase except names; no jargon, chips, or percentages on child screens.
- Motion: `transform`/`opacity` only, ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, ≤ 300 ms for UI, ≤ 1.5 s celebrate; everything static under `prefers-reduced-motion` or Calm mode (`html[data-calm="true"]`).
- Touch targets ≥ 88 px child, ≥ 44 px parent; `user-scalable=no` removed; `viewport-fit=cover`; `100dvh`; `overscroll-behavior: none`; `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on tappables; `:hover` only inside `@media (hover: hover) and (pointer: fine)`.
- UI agents read `DESIGN.md`, `PRODUCT.md`, `.agents/skills/emil-design-eng/SKILL.md`, `.agents/skills/animate/SKILL.md`, `.agents/skills/mobile-native/SKILL.md` before writing a screen.
- Commit after each task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Mic fires on the app's own voice or the parent's model → `useAttempt` must stay disarmed until `speak()` resolves + 400 ms (test in Task 3).
2. Child taps "I saw it" → nothing happens unless held 600 ms (test in Task 3).
3. Log grows forever → cap at 2000 records, oldest dropped (test in Task 2).
4. Old install upgrades → name and photos imported once; old keys untouched (test in Task 2).
5. Mic denied / no `speechSynthesis` → activities still run with the hold button and silent text (Task 3 handles `micState: 'denied'`, `speak()` resolves immediately when unsupported).

---

### Task 1: Teardown and foundation

**Files:**
- Delete: `src/App.tsx`, `src/ui/*`, `src/vision/`, `src/audio/personalizedSpeech.ts`, `src/data/settings.ts`, `src/data/settings.test.ts`, `src/data/sessionLog.ts`, `src/data/sessionLog.test.ts`, `src/index.css`, `public/models/`, `tools/fetch_models.mjs`, `tools/*-smoke.mjs`, `tools/generate_clips.py`, `debug.log`, `vite-dev.*.log`
- Modify: `package.json` (remove `@mediapipe/tasks-vision`, `@tensorflow/tfjs`, `@tensorflow-models/speech-commands`, `playwright`, script `fetch-models`; add `@fontsource-variable/nunito`), `index.html`, `vite.config.ts` (drop `onnx,task,wasm` from `globPatterns`, `maximumFileSizeToCacheInBytes` → 5 MB, theme_color `#FFFDF7`, name "AlexSpeak"), `src/audio/useAudioEffort.ts` (replace the `Settings['audioVoiceProfile']` import with a local `type VoiceProfile = 'higher'|'middle'|'lower'|'wide'`), `src/audio/playClip.ts` (keep as is), `.gitignore` (drop `public/models`)
- Create: `src/theme.css`, `src/main.tsx` (imports `@fontsource-variable/nunito` and `./theme.css`), placeholder `src/App.tsx` that renders `<h1>AlexSpeak</h1>`

**Interfaces:**
- Produces: `src/theme.css` defining `:root` tokens exactly from `DESIGN.md` (`--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--pip`, `--star`, `--hue-ask`…`--hue-board` with `-deep` and `-tint` partners, `--ease-out`, `--ease-in-out`, `--dur-press: 120ms`, `--dur-ui: 220ms`, `--dur-celebrate: 1500ms`, `--radius-sm/md/lg/xl`), the global mobile-native rules from Global Constraints, `.chunky`, `.parent-btn`, `.chip`, `.chip--on`, `.tile`, `.strip`, `.word`, `.title`, `.small-caps`, and `@media (prefers-reduced-motion: reduce), html[data-calm="true"] * { animation: none !important; transition: none !important }`.

- [ ] Step 1: Delete the files listed, `npm uninstall` the four packages, `npm i @fontsource-variable/nunito`.
- [ ] Step 2: Write `index.html` (viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `theme-color #FFFDF7`, `<title>AlexSpeak</title>`), `src/theme.css`, `src/main.tsx`, placeholder `src/App.tsx`.
- [ ] Step 3: Run `npx tsc --noEmit && npm test && npm run build`. Expected: tsc clean; tests `engine/*.test.ts`, `audio/playClip.test.ts`, `data/imageProcessing.test.ts` pass; build output has no `.task`/`.onnx`/`.wasm`.
- [ ] Step 4: Commit `chore: tear down old loop, add theme tokens and Nunito`.

### Task 2: Content, settings, log, garden, session picker

**Files:**
- Create: `src/data/content.ts`, `src/data/settings.ts`, `src/data/settings.test.ts`, `src/data/log.ts`, `src/data/log.test.ts`, `src/data/garden.ts`, `src/data/garden.test.ts`, `src/engine/session.ts`, `src/engine/session.test.ts`
- Keep: `src/data/memoryStorage.ts` (`StorageLike`, `MemoryStorage`), `src/data/imageStore.ts`

**Interfaces (Produces):**
```ts
// content.ts
export type ActivityId = 'ask'|'choose'|'copy'|'uhoh'|'song'|'board'|'memory'|'count'|'find'
export interface Target { id: string; shown: string; spoken: string }   // spoken = TTS-safe form ("mah" for "ma")
export interface Motivator extends Target { glyph: GlyphId }             // glyph = key into the SVG glyph set (Task 3)
export type GlyphId = 'bubbles'|'snack'|'car'|'tickle'|'swing'|'music'|'ball'|'tablet'|'sock'|'spoon'|'box'|'dog'|'cup'|'cat'|'star'
export const DEFAULT_MOTIVATORS: Motivator[]     // bubbles, snack, car, tickle, swing, music, ball, tablet
export const NEUTRAL_ITEMS: Motivator[]          // sock, spoon, box
export const CORE_WORDS: (Target & { glyph: GlyphId | 'more'|'alldone'|'help'|'open'|'go'|'stop'|'up'|'mine' })[]  // exactly: more, all done, help, open, go, stop, up, mine
export const COPY_LADDER: { rung: number; label: string; targets: Target[] }[]
//   0 ah·oh·ee·oo · 1 ma·ba·da·pa·no·go · 2 mama·baba·dada·bye-bye·no-no · 3 up·on·off·out·eat · 4 more·mine·stop·help·open
export const SONGS: { id: string; title: string; lead: string; blank: Target }[]
//   ready-set-go ("ready, set," → go) · row-boat ("row, row, row your" → boat) · twinkle ("twinkle twinkle little" → star) · peekaboo ("peek-a-" → boo) · count ("one, two," → three)
export const FIND_ITEMS: Motivator[]             // dog, car, cup, ball, cat, star
export const ACTIVITIES: { id: ActivityId; label: string; hue: 'ask'|'choose'|'copy'|'uhoh'|'song'|'board'; tip: string; why: string }[]  // tip = the parent strip sentence from the canvas, why = 3 sentences
export const MIXED_POOL: ActivityId[]            // ['uhoh','copy','ask','choose','song','memory','count']
export function wordForm(m: Motivator, level: 0|1|2): Target   // 'bubbles' | 'more bubbles' | 'want bubbles'

// settings.ts  (key 'alexspeak.v2.settings'; legacy key 'alexspeak.settings' read once for childName)
export type MicLevel = 'quiet'|'normal'|'loud'
export interface Settings { version: 2; childName: string; motivatorIds: string[]; customMotivators: Motivator[]; copyRung: number; countMax: 3|5|10; sessionMinutes: 2|3|5; micLevel: MicLevel; calm: boolean; volume: number; voiceName: string|null; voiceMode: 'server'|'system'; serverVoice: string; importedLegacy: boolean }
export const DEFAULT_SETTINGS: Settings   // childName 'Alex', motivatorIds first 4 defaults, copyRung 1, countMax 3, sessionMinutes 3, micLevel 'normal', calm false, volume 0.9, voiceMode 'system'
export function loadSettings(storage?: StorageLike): Settings   // merges defaults; on first load with importedLegacy false copies legacy childName and sets importedLegacy true (saved)
export function saveSettings(s: Settings, storage?: StorageLike): void
export function micThresholds(level: MicLevel): { sensitivity: number; noiseRejection: number }  // quiet {22,35} normal {32,45} loud {44,60}
export function activeMotivators(s: Settings): Motivator[]

// log.ts (key 'alexspeak.v2.log', MAX_RECORDS = 2000)
export type Channel = 'sound'|'touch'|'parent'
export type Rung = 'looked'|'reached'|'sound'|'close'|'word'
export type LogRecord =
  | { kind: 'attempt'; t: number; activity: ActivityId; target: string; channel: Channel; rung?: Rung; prompts: number }
  | { kind: 'sat'; t: number; activity: ActivityId; target: string }
  | { kind: 'session'; t: number; ms: number }
export function loadLog(storage?): LogRecord[]
export function appendRecord(r: LogRecord, storage?): void
export interface WeekSummary { plays: number; attempts: number; sounds: number; close: number; words: number; requests: number; favourite: ActivityId|null; byWord: { target: string; best: Rung|null; count: number }[]; byActivity: Record<ActivityId, number> }
export function weekSummary(log: LogRecord[], now?: number): WeekSummary   // last 7 days; sounds/close/words count rung (or channel 'sound' when no rung); requests = attempts in 'ask'
export function wordRungCount(log: LogRecord[], target: string, rung: Rung): number
export function slpSummary(log: LogRecord[], childName: string, now?: number): string   // plain text, one page: header, week totals, per-activity lines, per-word best rung, last 20 attempts with date/activity/target/prompts/response

// garden.ts (key 'alexspeak.v2.garden')
export interface Garden { stars: number; flowers: number }   // stars 0..4
export function loadGarden(storage?): Garden
export function addStar(storage?): { garden: Garden; grew: boolean }   // 5th star → stars 0, flowers+1, grew true

// session.ts
export function pickNext(pool: ActivityId[], counts: Record<ActivityId, number>, last: ActivityId|null, rng?: () => number): ActivityId
//   first pick with last===null → 'uhoh' if in pool; else the activity with the fewest counts (ties broken by rng), never equal to last
```

- [ ] Step 1: Write the failing tests: `settings.test.ts` (defaults; legacy childName imported once; `micThresholds('quiet')` equals `{sensitivity:22,noiseRejection:35}`), `log.test.ts` (append caps at 2000 keeping newest; `weekSummary` ignores records older than 7 days and counts a `channel:'sound'` attempt without rung as a sound; `slpSummary` contains the child's name and the word "bubbles" after one ask attempt), `garden.test.ts` (five `addStar` → `{stars:0, flowers:1}`, `grew` true only on the fifth), `session.test.ts` (first pick is `uhoh`; never repeats `last`; picks the fewest-count activity).
- [ ] Step 2: Run `npm test`. Expected: the four new files fail with "cannot find module".
- [ ] Step 3: Implement the five modules per the interfaces. `content.ts` tips are the exact strip sentences on the canvas artboards.
- [ ] Step 4: `npm test`. Expected: all pass. `npx tsc --noEmit` clean.
- [ ] Step 5: Commit `feat: content, settings, log, garden and session picker`.

### Task 3: Voice, attempt detection, Pip, glyphs, ActivityFrame, Home, App shell

**Files:**
- Create: `src/audio/voice.ts`, `src/audio/useAttempt.ts`, `src/audio/useAttempt.test.ts`, `src/ui/Pip.tsx`, `src/ui/Glyph.tsx`, `src/ui/HoldButton.tsx`, `src/ui/Stars.tsx`, `src/activities/ActivityFrame.tsx`, `src/screens/Home.tsx`, `src/screens/AllDone.tsx`, `src/App.tsx` (replace placeholder), `src/activities/Placeholder.tsx` (temporary: shows the activity label and one `runTrial` on a 'star' target; deleted in Task 7)
- Keep/use: `src/audio/playClip.ts` (`play`, `stopAllPlayback`, `listSystemVoices`), `src/audio/useAudioEffort.ts` (`AudioEffortChannel`), `src/engine/detection.ts` (`DetectionFuser`, re-type `Channel` to log.ts's), `src/engine/phrases.ts` (`PRAISE_LINES`, `ENCOURAGE_LINES`, `makePicker`)

**Interfaces (Produces):**
```ts
// voice.ts
export function speak(text: string, s: Pick<Settings,'volume'|'voiceName'|'voiceMode'|'serverVoice'>): Promise<void>  // id = slug(text); resolves immediately if no speechSynthesis; never rejects
export function stopSpeaking(): void

// useAttempt.ts
export type MicState = 'off'|'asking'|'on'|'denied'
export interface AttemptApi { armed: boolean; micState: MicState; level: number /*0..100 live*/; reportTouch(): void; reportParent(): void; requestMic(): Promise<void> }
export function useAttempt(opts: { armed: boolean; micLevel: MicLevel; onAttempt: (c: Channel) => void }): AttemptApi
//   one attempt per arm (DetectionFuser); mic created lazily on requestMic(); paused while !armed

// Pip.tsx
export type PipMood = 'listening'|'surprised'|'thinking'|'delighted'
export function Pip(props: { mood: PipMood; size?: number; className?: string }): JSX.Element   // SVG from DESIGN.md §5

// Glyph.tsx
export function Glyph(props: { id: GlyphId | CoreGlyphId; hue: string; size?: number; photo?: string|null }): JSX.Element   // photo (data URL) wins over the SVG

// HoldButton.tsx
export function HoldButton(props: { label: string; holdMs?: number /*600*/; hue: string; onHold: () => void }): JSX.Element   // conic ring fills while held; pointercancel/leave resets

// ActivityFrame.tsx
export type TrialOutcome = { kind: 'attempt'; channel: Channel; rung?: Rung; prompts: number } | { kind: 'sat' }
export interface FrameApi { runTrial(target: Target, opts?: { say?: boolean /*default true*/; waitMs?: number /*5000*/; listening?: boolean /*true*/ }): Promise<TrialOutcome>; say(text: string): Promise<void>; touch(): void; listening: boolean; celebrating: boolean; pipMood: PipMood }
export function ActivityFrame(props: { activity: ActivityId; settings: Settings; onExit: () => void; onStar: () => void; children: (api: FrameApi) => React.ReactNode }): JSX.Element
//   runTrial: say(spoken) → arm after speak resolves + 400 ms → wait waitMs → if no attempt: say again, wait again → 'sat' (log sat, say an ENCOURAGE line)
//   on attempt: disarm, log attempt (rung filled if parent taps a chip within 3 s), say `${shown}! yes!`, celebrate overlay 1.5 s, onStar(), resolve
//   renders: strip (✕ + tip; tint + "Give/Do…" text while celebrating comes from ACTIVITIES[id].celebrateTip), children(api), Pip, HoldButton (reportParent), rung chips, mic permission card the first time runTrial needs the mic (requestMic on "Yes, listen"; 'Not now' keeps going without mic)

// App.tsx: view state 'home' | { activity: ActivityId; mixed?: { endsAt: number; last: ActivityId|null } } | 'parent' | 'alldone'
//   Home 'Play' → mixed session: pickNext over MIXED_POOL using weekSummary().byActivity; when an activity's component calls onDone and now ≥ endsAt → log session, show AllDone
//   long-press 1.5 s on the lock → 'parent' (Task 6 fills it; until then a stub with a close button)
```

- [ ] Step 1: Write `useAttempt.test.ts` with a fake channel: (a) `reportTouch()` while `armed` calls `onAttempt('touch')` once even if called twice; (b) while `!armed` nothing fires; (c) re-arming allows a new attempt.
- [ ] Step 2: Run it; expected fail. Implement `voice.ts`, `useAttempt.ts`; test passes.
- [ ] Step 3: Build `Pip`, `Glyph` (15 motivator/item glyphs + 8 core-word icons, all ≤ 12 lines of SVG each, matching the canvas), `HoldButton`, `Stars` (5 stars, n filled).
- [ ] Step 4: Build `ActivityFrame` per the interface and the canvas (AskForIt/Celebrate/MicAsk artboards are the reference), then `Home` (greeting + Pip, star jar, 300 px Play, 6 + 3 tiles, lock corner; phone layout per PhoneHome artboard), `AllDone` (garden SVG with `flowers` flowers, "5 stars — a new flower grew" when `grew`, Home button, session sentence), `App`.
- [ ] Step 5: `npm test`, `npx tsc --noEmit`, `npm run dev`; in the browser: Home renders, Play opens the placeholder, ✕ returns, hold button celebrates after 600 ms, a short tap does nothing, Calm mode attribute stops the ring.
- [ ] Step 6: Commit `feat: activity frame, home, all done, pip and glyphs`.

### Task 4: Ask for it, Choose, Talk board (parallel-safe: only these files)

**Files:** Create `src/activities/AskForIt.tsx`, `Choose.tsx`, `TalkBoard.tsx`; register in `src/activities/index.ts` (`export const ACTIVITY_COMPONENTS: Record<ActivityId, React.ComponentType<ActivityProps>>`, created in Task 3 with placeholders; each task replaces its own entries).

**Interfaces (Consumes):** `ActivityProps = { api: FrameApi; settings: Settings; photos: Record<string,string>; onDone: () => void }`.

- [ ] AskForIt: cycles `activeMotivators`; per motivator `runTrial(wordForm(m, level))` where level = min(2, floor(wordRungCount(log, m.id, 'word') / 3)); after each trial `onDone()`.
- [ ] Choose: two cards (motivator vs neutral, alternating sides each round); tapping a card = `api.say(shown)` then `api.touch()`; then `runTrial(target, { say: false, waitMs: 0 })` is NOT used — instead touch resolves the frame's pending trial: call `api.runTrial(target, { say: false })` on mount of each round and let the touch resolve it.
- [ ] TalkBoard: 2×4 core grid + motivator row, fixed order; tap = `say(shown)` + log `{kind:'attempt', channel:'touch'}` via `api.touch()` inside a `runTrial(target,{say:false, listening:false})`; no celebrate overlay for board taps (frame prop `quiet: true` on runTrial → logs + Pip delighted 600 ms only).
- [ ] One render test each with a stub `FrameApi`; commit `feat: ask for it, choose, talk board`.

### Task 5: Copy me, Song, Uh-oh, Memory match, Count, Find it (parallel-safe)

**Files:** Create `src/activities/CopyMe.tsx`, `Song.tsx`, `UhOh.tsx`, `MemoryMatch.tsx`, `CountDots.tsx`, `FindIt.tsx`.

- [ ] CopyMe: rung from `settings.copyRung`; shows mouth SVG in listen ring + word; `runTrial(target)` says it twice slowly (two `say` calls); "again" button re-says; parent ladder chips set the rung for this session; after 5 attempts at rung show strip hint "ready for the next rung?".
- [ ] Song: `say(lead)` then `runTrial(blank, { say: false })`; on attempt `say(blank.shown)` happens via the frame's celebrate line; song chips choose the song.
- [ ] UhOh: three scenes (tower: 5 taps then fall; bubbles: tap blows, tap pops; car: tap goes, hits wall). Each tap `say` the small word ("up", "pop", "vroom"); the scene event triggers `runTrial({shown:'uh-oh!', spoken:'uh oh'})`. SVG scenes ≤ 60 lines each; motion via CSS transform only.
- [ ] MemoryMatch: 3 pairs from `FIND_ITEMS`, 6 cards, flip on tap (CSS rotateY 220 ms); on match `runTrial(item)`; after 3 matches `onDone()`.
- [ ] CountDots: N = `settings.countMax` chosen per round (random 1..N); taps count aloud via `say`; on last dot `say('one, two,')` style lead (numbers up to N-1) then `runTrial({shown: numberWord(N), spoken: numberWord(N)}, { say: false })`.
- [ ] FindIt: `say('touch the ' + target.shown)`; 3 glyph cards; any touch → `say(touched.shown)` + resolve trial via `api.touch()`.
- [ ] One render test each; commit `feat: copy me, song, uh-oh, memory, count, find it`.

### Task 6: Parent area (parallel-safe)

**Files:** Create `src/screens/Parent.tsx`, `src/screens/Progress.tsx`, `src/screens/SetUp.tsx`, `src/screens/Why.tsx`, `src/ui/MicMeter.tsx`; modify `src/App.tsx` only at the `'parent'` branch.

- [ ] Progress: `weekSummary` → the sentence from the canvas, per-word rows with 5-segment bars (best rung), garden card, "Share with your SLP" → `navigator.share({text})` else download `alexspeak-summary.txt`.
- [ ] SetUp: name input, motivator chips (toggle `motivatorIds`; "add a photo" → `fileToResizedDataUrl` → `putTargetImage(id)`, custom motivator with `glyph:'star'`), play length 2/3/5, mic level with `MicMeter` (uses `useAttempt({armed:true, …})` level), Calm mode switch (sets `html[data-calm]`), voice picker (`listSystemVoices`), the "practice tool" note.
- [ ] Why: one card per activity from `ACTIVITIES[].why`.
- [ ] Commit `feat: parent area`.

### Task 7: Integration, audits, polish

- [ ] Delete `Placeholder.tsx`; wire `ACTIVITY_COMPONENTS` fully; update `README.md` (new flow, scripts, remove fetch-models/clips sections); `npm test && npx tsc --noEmit && npm run build`.
- [ ] Audit agents (read-only, report tables): `review-animations` + `animation-performance` over `src/**/*.tsx|css`; `break-ui` on Home, ActivityFrame, Progress with worst-case names/counts; `impeccable critique` of Home and AskForIt against `DESIGN.md`. Apply the fixes.
- [ ] Browser walkthrough in desktop Chrome at 1180×820 and 390×844: Home → Play → three activities → All done; parent long-press; Calm mode; mic denied path.
- [ ] Commit `feat: AlexSpeak revamp — activities, games, companion, parent area`.
