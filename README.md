# AlexSpeak — Speech Encouragement App

A gentle, offline, on-device app that prompts a non-verbal / minimally verbal autistic
person to vocalize a target word and rewards **any communicative effort** — a sound, a
mouth movement, or a caregiver's confirmation — with warm, immediate, positive feedback.

**The one idea that drives everything:** this is not a "say the word correctly →
pass/fail" app. It copies how speech-language pathologists actually work — *shaping*:
reward any vocal attempt first. The detectors answer "did an attempt happen," never
"was it right." The app never dead-ends in a try-again loop.

## How it works

```
PROMPT  →  "Alex, can you say apple?"  + big picture     (mic detector paused)
LISTEN  →  ~6 s window, three channels armed at once:
             🔊 live vocal-effort score (quiet "ah" sounds, tuned hot)
             👄 MediaPipe mouth-movement score (silent mouthing)
             👀 MediaPipe attention score (face present, centered, visible)
             👀 caregiver "I saw it!" button
   any channel fires → CELEBRATE  (praise + gentle stars) → next word
   window expires    → MODEL      (re-say the word warmly) → listen again
                       after 2–3 re-prompts → ENCOURAGE (warm, zero pressure) → move on
```

Everything runs in the browser. **No audio or video ever leaves the device.**

## Getting started

```bash
npm install
npm run fetch-models   # copies MediaPipe assets into public/models (one-time)
npm run dev            # open the printed URL, allow mic (and camera)
```

`npm run build` produces an installable offline PWA in `dist/` (serve it over HTTPS
or localhost; use "Install app" / "Add to Home Screen").

`npm test` runs the unit tests for the state machine, detection fusion, phrase bank,
settings, and session log.

## Voice clips (optional but recommended)

Out of the box the app speaks with the browser's built-in voice. For a warmer,
identical-every-time voice, pre-render clips with Kokoro (local, free):

```bash
pip install kokoro soundfile numpy
python tools/generate_clips.py --name Alex --words apple ball up more
```

Clips land in `public/clips/` and are picked up automatically (and precached for
offline use on the next build). Re-run after changing the name or word list.

## Caregiver settings (⚙️ in the app)

Name used in prompts · target words + pictures · listen-window length · number of
gentle re-prompts · words per session · vocal-effort, Alex voice range, noise-filter,
mouth, and attention thresholds · camera channel on/off · volume · fallback voice.

For audio tuning, start stricter: keep **Noise filter strength** around 65–75%, pick the
closest **Alex voice range**, then lower **Vocal effort trigger** only if his real “ah”
sounds are not scoring.

## Progress (📈 in the app)

Per-trial log (word, which channel fired, response latency, re-prompts) stored in
`localStorage` only. The export button downloads a JSON summary you can share with a
speech-language pathologist.

## Project layout

```
src/engine/    pure state machine, detection fusion, phrase bank  (unit tested)
src/audio/     mic capture, live vocal-effort scoring, clip playback
src/vision/    MediaPipe Face Landmarker → mouth + attention scoring
src/ui/        prompt / reward / settings / progress screens
src/data/      settings + local-only session log                  (unit tested)
tools/         build-time only: clip generation (Python), model fetching (Node)
public/models/ ML assets served locally — created by npm run fetch-models
public/clips/  pre-rendered voice clips — created by generate_clips.py
```

## Important notes

- **Involve an SLP if at all possible.** They set achievable targets and can confirm
  whether verbal output is the right goal. This is a practice supplement, not a
  replacement for therapy or human connection. Not a medical device.
- **Respect AAC.** For many non-speaking people, picture/symbol communication is the
  primary, valid path. Verbal practice is one option, not the only success.
- **Mic proximity is the cheapest big win** — a clip-on mic near the mouth raises
  quiet sounds far above the noise floor.
- Watch for signs the app is becoming aversive and let him disengage — the ✋ Stop
  button is always one tap away.
