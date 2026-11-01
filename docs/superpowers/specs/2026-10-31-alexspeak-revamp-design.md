# AlexSpeak revamp — design

**Date:** 2026-10-31
**Status:** Draft for approval
**Replaces:** the 2026-06-11 design. Everything in the old app is up for removal unless listed under "Keep".

## Intent

Turn AlexSpeak from a single "say the word → stars" loop into a small set of real
communication activities that a parent and a minimally verbal autistic child (roughly
ages 3–8) do together, at home, on a tablet, offline. The tablet is a scaffold for the
interaction, not the thing the child plays alone.

The one rule that stays: **reward any attempt, never pass/fail.**

The one new rule: **as simple to start as Subway Surfers.** Open the app, tap the
screen, you're playing. No landing page, no level picker, no permission wall, no
jargon anywhere the child can see.

## Why (from the audit and research)

- Today's app rewards noise. It never teaches the child that sounds change the world
  (requesting), which is the activity with the strongest evidence (PRT / mand training,
  JASPER, Hanen). The current word list (apple, ball, letters A–Z) is label-only
  vocabulary SLPs put last; core words (more, all done, help, open, go, stop, up, mine)
  come first.
- The camera channel (25 MB MediaPipe) never completes a trial; the personal TF voice
  model is a dev toy; the VAD assets (17 MB) are unreferenced. Together they are ~48 MB
  of precache and most of the complexity in a 1048-line `App.tsx`.
- The UI shows the child clinician text ("Imitate the sound · sound: ba",
  "Voice calibrating"), overlays caregiver controls on the child's screen, and uses a
  beige palette with an unloaded font.

## Goals

1. Six activities a parent can run in under a minute each, each with a one-line
   coaching tip for the parent.
2. One-tap start. First launch to first activity in ≤ 2 taps. Mic permission is asked
   inside the first activity that needs it, with a plain sentence; everything works
   without the mic via the parent's "I saw it!" button.
3. A child-facing screen with zero jargon: big picture, big word, one thing to do.
4. Progress a parent understands at a glance and can hand to an SLP as a one-page
   summary.
5. Still 100 % offline and on-device. No network at runtime, ever.
6. Sensory-safe: no flashing, no sudden loud sounds, slow motion, honours
   `prefers-reduced-motion`, volume control.

## Non-goals

- Speech recognition / correctness scoring. We detect *that* an attempt happened, not
  *what* was said.
- A full AAC system. The Talk Board is a starter set, fixed layout, editable by the
  parent; not Proloquo.
- Accounts, sync, cloud, analytics.
- Camera / mouth detection, TF personal voice model, Silero VAD. Removed.
- Treating apraxia or any clinical claim. Settings carry a one-line "practice tool; an
  SLP should set goals" note.

## Anti-goals (would make it a failure even if it works)

- Rewards so flashy the child chases the screen instead of the parent.
- Any "wrong" sound, buzzer, red X, or a try-again loop.
- Screens that need reading to operate (for the child) or a manual to operate (for the
  parent).
- The child playing alone: every activity ends by sending the child back to the parent
  or the real object.

## The app, screen by screen

### Home = Play

Opening the app shows one screen:

- Top: child's name as a greeting ("Hi Alex 👋"), small.
- Center: a huge round **Play** button. Tapping it (or anywhere on the empty
  background) starts a **mixed session**: the app picks activities for ~3 minutes
  (parent-adjustable 2–5 min), then shows "All done!" and returns here. The session
  order is engagement → copy → request → choose → fill-in, biased toward activities the
  parent has set up (e.g. Ask-for-it needs a motivator chosen) and toward activities with
  the fewest attempts this week.
- Below: six big picture tiles, one per activity, no text needed (label under each,
  for the parent). Tap a tile → that activity starts immediately.
- Bottom-right: a small parent corner icon. **Long-press 1.5 s** (so the child can't
  open it) → Parent area.

No level picker. No "Start session". No permission prompt until an activity needs the
mic, and then it is a single sentence over the activity, not a wall.

### The six activities

Every activity shares the same frame:

- Child area: full screen, big picture / scene, big word under it.
- A thin parent strip at the very top (small, grey, readable by an adult): the
  coaching tip for this activity ("Hold the bubbles up. Wait 5 seconds. Any sound =
  give bubbles.").
- A **listen ring** around the target when the app is waiting for the child
  (slow breathing animation, ~5 s). Mic attempt, parent tap on the big
  "I saw it!" button (bottom), or a direct touch on the target (where touch is the
  response) ends the wait.
- **Celebrate**: the word spoken warmly once ("Bubbles! Yes!"), a calm burst of
  stars that fades in ~1.5 s, then the parent strip says what to do in the real world
  ("Give the bubbles now"). An optional one-tap rung chip row for the parent appears
  for 3 s: 👀 looked · ✋ reached · 🔊 sound · 🗣 close · ⭐ word. If untouched, the
  detected channel is logged (sound / touch / parent).
- **No miss state.** If ~5 s pass with nothing, the app re-models the word once,
  gently, and waits again. After the second wait it moves on with a warm line
  ("Good sitting with me!") — the parent keeps the real item in play.
- Exit: small ✕ top-left, always.

1. **Ask for it** (requesting / manding). Parent set-up once: pick motivators from a
   list (bubbles, snack, tickles, swing, car, music, iPad…) or photograph the real
   thing (keep the existing `imageStore`). In play: the motivator picture fills the
   screen with its word ("bubbles"), the app says "Bubbles?" once and waits. Any
   attempt → celebrate + "Give the bubbles now." The real item is the reward; the
   screen never substitutes for it. Next prompt alternates the word form up one rung
   when the parent has logged "word" three times ("bubbles" → "more bubbles").

2. **Choose** (choice-making). Two big pictures side by side (wanted item vs clearly
   not wanted, parent picks; defaults alternate a motivator and a neutral item). Touch
   speaks the word. Touch itself counts as communication (logged as ✋). Parent strip:
   "Give whichever one Alex picked, right away."

3. **Copy me** (sound imitation ladder). A big friendly mouth shape (simple SVG, not a
   face), the target in huge letters, the voice models it twice slowly, then the
   listen ring. Ladder, in this order, parent can jump rungs:
   - open vowels: ah · oh · ee · oo
   - CV: ma · ba · da · pa · no · go
   - reduplicated: mama · baba · dada · bye-bye · no-no
   - VC: up · on · off · out · eat
   - CVC core: more · mine · stop · help · open
   Parent strip: "Copy any sound Alex makes first, then say the target once."

4. **Uh-oh!** (exclamatory / cause-and-effect play). Three tiny scenes, touch-driven:
   - **Tower**: tap to stack a block (each tap "up!"); fifth tap it tumbles — "uh-oh!"
   - **Bubbles**: tap to blow a bubble; tap the bubble — "pop!"
   - **Car**: tap to go — "vroom!"; hits the wall — "boom!"
   The exclamation is modelled once, then a short listen ring. Any attempt celebrates
   and the scene resets. Slow, soft motion only.

5. **Fill in the song** (routine fill-ins). Audio of a known routine stops before the
   last word and waits: "Ready, set, ___ (go)", "Row row row your ___ (boat)",
   "Twinkle twinkle little ___ (star)", "Peek-a-___ (boo)", "1, 2, ___ (3)". The
   pause is the cue. Any attempt → the app completes the line and celebrates. Parent
   strip: "Sing it with your voice too. Stop at the same place every time."

6. **Talk board** (starter AAC). A fixed 2×4 grid of big buttons that speak on touch:
   more · all done · help · open · go · stop · up · mine, plus the parent's motivators
   on a second row. Positions never change. Every touch is logged as communication.
   Parent strip: "When Alex touches a word, do it. Model by touching it yourself."

### Celebrate, on the record

Each attempt logs: time, activity, target, channel (sound / touch / parent), rung if
the parent tapped one, prompt count before the attempt. No `success:false`. Timeouts
log as a "sat with it" line, counted separately, never shown as a miss.

### Parent area (long-press)

Three tabs, plain words, big controls:

- **Progress**: This week: minutes played, attempts, sounds, words tried, requests
  made; most-used words; per-word rung trend (little 5-step bars). "Share with your
  SLP" → copies/downloads a plain-text one-page summary (dates, activities, prompt
  levels, responses).
- **Set up**: child's name; motivators (pick + photo); Choose pairs; which Copy-me rung
  to start at; session length; volume; mic sensitivity as a 3-step chip
  (quiet voice / normal / loud room) with a live meter so the parent can see it
  react; reduced motion; voice (device voice list). Nothing technical.
- **Why this works**: one card per activity, three sentences each, the evidence base
  in plain language, and the "practice tool, not treatment" note.

## Visual design

- **Feel:** bright, warm, simple. Think Duolingo ABC's restraint: one big thing on a
  white-ish page, a single saturated colour per activity. Not beige-clinical, not
  Nick-Jr-loud.
- **Palette:** background `#FFFDF7` (warm white), ink `#1F2933`. One accent per
  activity: Ask `#FF8A3D` (orange), Choose `#5B8DEF` (blue), Copy `#7C5CE6` (violet),
  Uh-oh `#F2555A` (coral), Song `#2BB673` (green), Board `#F5B700` (yellow). Accents
  are used as big flat fills with a darker 8 px bottom edge on buttons (chunky, pressable).
- **Type:** Nunito (bundled locally via `@fontsource/nunito`, no runtime network),
  900 weight for the child's word at 20 vw, 600 for everything else. Parent strip 15 px.
- **Shapes:** 32 px radius cards, 88 px minimum touch targets, generous whitespace.
- **Motion:** 300–600 ms ease-out only; listen ring breathes at 4 s; stars drift and
  fade, never flash. All motion off under `prefers-reduced-motion` or the parent
  toggle.
- **Layout:** tablet landscape first, works on phone portrait (tiles become 2 columns,
  Choose stacks vertically), nothing fixed-positioned over the child's target.

## Keep (from the current code)

- `src/engine/stateMachine.ts` reducer and `DetectionFuser` idea (one reward per wait).
- `src/engine/phrases.ts` praise/encourage banks and `makePicker`.
- `src/data/settings.ts` persistence pattern (defaults merge, versioned migration);
  the Settings shape itself is replaced and keyed under a new storage key.
- `src/data/imageStore.ts` + `imageProcessing.ts` (parent photos, IndexedDB).
- `src/audio/playClip.ts` voice chain (server Kokoro in dev → clips → Web Speech).
  Default voice mode becomes `system` so a static PWA build sounds the same as dev.
- `src/audio/useAudioEffort.ts` mic effort detector (create/pause/resume/destroy).
- PWA setup in `vite.config.ts`; sensory-safe philosophy.

## Remove

- `App.tsx` as a god component; `PromptScreen`, `RewardScreen`, `Settings.tsx`,
  `Progress.tsx`, `CaregiverButton.tsx` (rebuilt).
- `src/vision/useMouth.ts`, `src/audio/personalizedSpeech.ts`, their settings, and the
  deps `@mediapipe/tasks-vision`, `@tensorflow/tfjs`, `@tensorflow-models/speech-commands`.
- `public/models/vad`, `public/models/mediapipe`, `public/models/speech-commands` and
  the matching parts of `tools/fetch_models.mjs` (the script goes away entirely if
  nothing is left to fetch).
- Levels 0–3 and the letter curriculum; adaptive-support level shifting; shaping
  auto-promotion/demotion by thresholds; the coach face; the "Voice calibrating"
  chips; the `tools/*-smoke.mjs` scripts that target removed screens.
- `index.html` `user-scalable=no`.

## Code shape (for the builder)

```
src/
  main.tsx, App.tsx              # router-less view switch: play | activity | parent
  theme.css                      # tokens, type, motion, reduced-motion
  engine/  stateMachine.ts, detection.ts, phrases.ts (kept) + session.ts (mixed-session picker)
  data/    settings.ts (new shape, new key), log.ts (new record), imageStore.ts (kept)
  audio/   playClip.ts, useAudioEffort.ts (kept), useAttempt.ts (mic + parent button + touch → one "attempt" event)
  activities/
    ActivityFrame.tsx            # parent strip, listen ring, celebrate overlay, ✕, I-saw-it button
    AskForIt.tsx  Choose.tsx  CopyMe.tsx  UhOh.tsx  Song.tsx  TalkBoard.tsx
    content.ts                   # ladders, songs, core words, default motivators
  screens/ Play.tsx  Parent.tsx (Progress / SetUp / Why)
```

- Each activity is a component that receives `{ onAttempt, onDone }` from
  `ActivityFrame` and owns only its scene. The frame owns waiting, celebrating,
  logging, and re-modelling.
- Song audio is Web Speech lines (offline); no audio files to ship. Parent strip tells
  the parent to sing along.
- Tests: `session.ts` picker, `log.ts` summary, `content.ts` ladder order, settings
  migration, and `useAttempt` fusion (one attempt per wait). Activities get one
  render smoke test each.

## Decisions left to the builder

- Exact SVG scenes for Uh-oh (keep each under ~60 lines of SVG).
- Whether Choose defaults come from motivators or a fixed neutral list.
- Mic sensitivity mapping from the 3 chips to `useAudioEffort` thresholds.
- Plain-text SLP summary wording.

## Calls made after the builder check (designer's decisions, owner can override)

1. **Art:** emoji for motivators, Choose items and Talk Board words (one emoji per
   word, no reuse across words); hand-written simple SVG for the six activity tiles,
   the Copy-me mouth and the Uh-oh scenes. No licensed art. Parent photos override
   emoji wherever a motivator appears.
2. **Voice for sounds and syllables:** Web Speech, with a per-target `spoken` string
   that TTS pronounces correctly ("ah" → "ahh", "ma" → "mah", "oo" → "ooo", "pa" →
   "pah"). `content.ts` carries `spoken` next to `shown`. No audio files are shipped.
   The dev-only Kokoro server stays as an optional nicer voice.
3. **Mic gating:** the listen ring opens only after the app's own TTS ends plus a
   400 ms dead-time; the parent strip asks the parent to model *before* the ring, and
   the mic is paused during any re-model. Mic stays on by default; "I saw it!" is
   always available. Logged channel is what fired; the parent's rung chip overrides it.
4. **Parent controls on the child's screen:** "I saw it!" is a medium button at the
   bottom-right that needs a **600 ms hold** (ring fills) so a child's tap does
   nothing; ✕ is small and top-left; rung chips are small and only shown for 3 s after
   a celebrate. Nothing sits over the target.
5. **Old data:** on first run of the new version, import the child's name and any
   photos from the old store as motivators, once. The old settings key and old session
   log are left in place and ignored (not deleted). No old progress is migrated.
6. **Progression semantics:** Ask-for-it moves a motivator up one word form after three
   parent-logged "word" rungs for that motivator, all-time, not necessarily
   consecutive; never steps down. Copy-me advances only by the parent's jump; after
   five attempts at 🔊 or better on a rung the parent strip suggests the next rung.
   "Fewest attempts this week" counts every channel.
7. **Primary target:** Android Chrome on a tablet (installed PWA), tested in desktop
   Chrome during development; iPad Safari second. Mic permission in an installed PWA is
   re-asked when the browser forgets it, with the same one-sentence overlay.

## Additions approved on the design canvas (2026-11-01)

Canvas: https://claude.ai/artifact/9FymQdjmXTkJHXRpR6MpgA — the visual source of truth.

- **Pip**, a companion: a mint blob face shown on every child screen (bottom-left, or
  bottom-centre on Choose/Copy/Song/Count). States: listening, surprised (Uh-oh),
  thinking (Copy me), delighted (celebrate, all-done). It reacts; it never speaks.
- **Stars and the garden**: every attempt adds a star to a jar shown on Home (x of 5).
  At 5 the jar empties and a flower is added to the garden; All-done shows the garden
  and says "5 stars — a new flower grew" when one did. Stars are never removed.
- **Three attention games**, all ending in a speech moment, logged like any activity:
  - **Memory match** (choose blue): 6 cards, 3 pairs, parent and child take turns;
    on a match the pair's word is named big ("dog!") and the app waits for an attempt.
  - **Count the dots** (copy violet): N dots (parent picks up to 3 / 5 / 10); each tap
    counts aloud; on the last dot the app stops ("one, two, ___") and waits.
  - **Find it** (song green): "touch the dog" with 3 pictures; whichever is touched is
    named big and celebrated. No wrong answers.
- Home shows the three games as a second row of tiles under the six activities (on phone
  the tiles are a 3-column grid). The mixed Play session includes Memory match and Count
  the dots in its pool; Find it and Talk board stay tile-only.
- Celebrate rung chips: looked · reached · sound · close · word.
- Parent area tabs: Progress (this week as a sentence, per-word best-rung bars, garden
  count, "Share with your SLP"), Set up (name, things the child loves with photos, play
  length 2/3/5 min, mic level quiet/normal/loud with a live meter, Calm mode, voice),
  Why this works.

## Open questions for the owner

1. Should the mixed Play session include Talk Board (it is more of a tool than a game)?
   Builder default: no, Talk Board is tile-only.
2. Is 3 minutes the right default session length? Builder default: 3 min.
