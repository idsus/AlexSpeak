# Engine fixtures

`npm run engine:eval` replays every clip listed in `labels.json` through the real
`AttemptEngine` (Silero VAD OR energy, or energy-only when
`public/models/vad/silero_vad.onnx` is missing — run `npm run fetch-models`) and prints
recall, false accepts per minute and median latency per kind.

## What's here

The committed clips are synthetic and come from `node tools/make_fixtures.mjs`
(seeded, so re-running gives identical files): silence, white and pink noise at
−30 dBFS, harmonic "voice" proxies at 260 Hz (child) and 120 Hz (parent) at 1.0 s and
3.0 s over a −50 dBFS noise bed.

**They only prove the plumbing.** A tone is not a child. Real recall and false-accept
numbers need real session clips, and the design asks for ≥ 30 labelled clips before any
number is trusted.

## Adding real clips

1. Export or record a WAV: 16-bit PCM, any sample rate (resampled to 16 kHz), stereo is
   mixed down. A few seconds per clip is plenty.
2. Put it in this folder. **Real recordings of Alex stay out of git** — name them
   `real-*.wav` (ignored by `.gitignore` in this folder) and keep the labels in
   `labels.json` locally, or keep a separate copy of the folder.
3. Add an entry to `labels.json`:

   ```json
   { "file": "real-2026-11-02-ball.wav", "kind": "child", "attempts": [0.84, 2.6] }
   ```

   - `kind`: `child` (Alex), `parent` (an adult talking), `tts` (the app's own voice),
     `noise` (room, TV, kitchen), `silence`.
   - `attempts`: start time in seconds of every sound Alex made that should count. Only for
     `child` clips. Listen in Audacity (or similar) and note where each sound begins.
     An attempt within 1.0 s after a labelled start counts as caught; anything else the
     engine fires on is a false accept.
4. Run `npm run engine:eval`.
