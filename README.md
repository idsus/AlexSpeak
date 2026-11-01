# AlexSpeak

An offline tablet app for a minimally verbal autistic child and the parent sitting
next to them. Open it, tap Play, and you're playing. Every activity rewards **any**
attempt — a sound, a reach, a touch, or the parent holding "I saw it" — and never scores
right or wrong.

**The one idea that drives everything:** sounds and touches change the world. The screen
says "Give the bubbles now"; the real thing is the reward.

## What's inside

Nine short activities, each with a one-line coaching tip for the parent at the top:

| Activity | What it teaches | Colour |
|---|---|---|
| Ask for it | Requesting with a real motivator (bubbles, snack, a photo of their own toy) | orange |
| Choose | Picking between two pictures; a touch is talking | blue |
| Copy me | Sound imitation on a ladder: ah → ba → mama → up → more | violet |
| Uh-oh! | Cause and effect: stack blocks, blow bubbles, drive a car — and say "uh-oh!" | coral |
| Fill in the song | "Ready, set, ___" — the pause is the cue | green |
| Talk board | Eight fixed core words that speak when touched (more, all done, help, open, go, stop, up, mine) | yellow |
| Memory match | Flip cards, name what you found | blue |
| Count the dots | Count along, finish the last number | violet |
| Find it | "Touch the dog" — whatever is touched gets named | green |

Plus **Pip**, a soft companion who reacts to every attempt, and a **star jar**: five stars
grow a flower in the garden. Stars are never taken away.

The **parent area** (hold the lock in the corner for 1.5 s) has Progress as a plain
sentence with per-word bars and a one-page summary to share with an SLP, Set up (name,
things the child loves with photos, play length, mic level with a live meter, Calm mode,
voice), and Why this works.

Everything runs in the browser. **Nothing is recorded and nothing leaves the device.**
Calm mode (or the OS reduced-motion setting) turns all motion off.

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL on a tablet or in Chrome. The mic is asked for once, inside the
first activity that listens; "Not now" keeps everything working via the hold button.

`npm run build` produces an installable offline PWA in `dist/`. `npm test` runs the unit
tests (engine, data, activity render tests).

## Where things live

- `src/activities/` — one component per activity plus `ActivityFrame` (strip, listen ring,
  celebrate, logging) and `trial.ts` (the listen/celebrate cycle, tested).
- `src/data/` — `content.ts` (words, ladder, songs, tips), `settings.ts`, `log.ts`,
  `garden.ts`, `imageStore.ts` (parent photos, IndexedDB).
- `src/audio/` — `voice.ts` (Web Speech), `useAttempt.ts` (mic + touch + parent fusion),
  `useAudioEffort.ts` (on-device vocal-effort detector).
- `src/screens/` — Home, AllDone, Parent (Progress / SetUp / Why).
- `PRODUCT.md`, `DESIGN.md` — the product and visual rules the UI follows.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — the design and build plan.

AlexSpeak is a practice tool for home. A speech-language pathologist should set the goals.
