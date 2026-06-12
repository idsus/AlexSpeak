# Speech Encouragement App ("AlexSpeak") — Design

**Date:** 2026-06-11
**Status:** Approved (design authored by the user; this doc records it plus the concrete implementation decisions made while building).

## Purpose

A gentle, offline, on-device PWA that prompts a non-verbal / minimally verbal autistic person to vocalize a target word and rewards **any communicative effort** — sound, mouth movement, or a caregiver's confirmation — with warm, immediate, positive feedback.

## The driving idea

Not "say the word correctly → pass/fail." Speech recognition can't reliably hear emerging or atypical vocalizations, so correctness-based designs train *you keep failing*. Instead, copy SLP **shaping**: reward any vocal attempt first. The detector answers "did an attempt happen," not "was it right."

### Core principles

- **Reward effort, not accuracy.** Any sound, any mouth movement, or a caregiver tap = success.
- **Multimodal detection.** Audio OR vision OR manual override — three independent channels.
- **Run detectors hot.** Missing a real attempt is harmful; a false "I heard you!" costs nothing.
- **No infinite "try again."** Re-model the word gently, cap re-prompts at 2–3, ease off, end on a win.
- **Sensory-safe & predictable.** Same calm voice, adjustable volume, always-visible stop, caregiver-tunable everything.
- **Offline & on-device.** No audio/video ever leaves the device.
- **A supplement, not a replacement.** Supports work with an SLP; not a medical device.

## Architecture

| Layer | Choice |
|---|---|
| App shell | React + Vite, installable PWA (`vite-plugin-pwa`) |
| Listening (VAD) | Silero VAD via `@ricky0123/vad-web`, hot thresholds, gated around playback |
| Mouth movement | MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), blendshape `jawOpen` |
| Manual override | Big always-visible "I saw it!" caregiver button |
| Voice (TTS) | Pre-rendered clips from `tools/generate_clips.py` (Kokoro/ElevenLabs at build time); **runtime fallback: Web Speech API** so the app works before clips exist |
| Logic / praise | Plain React + a pure TypeScript state machine + hand-written phrase bank |
| Data | Local-only session log in `localStorage`, JSON export |

**Build-time vs runtime split:** Python lives at the workbench (clip generation, later personal-model training). The browser runs the app. Models (Silero ONNX, ORT wasm, MediaPipe wasm + `face_landmarker.task`) are copied/downloaded into `public/models/` by `tools/fetch_models.mjs` so everything serves locally and works offline.

## Interaction loop (state machine)

```
IDLE → PROMPT (play "[name], can you say apple?" + show image; VAD paused during playback)
     → LISTEN (~6 s window; VAD + jawOpen + caregiver button all armed)
         ├─ any channel fires → CELEBRATE (praise clip + animation) → next trial
         └─ window expires → MODEL (re-say word slowly, warmly — never "you failed") → LISTEN
              after maxReprompts → ENCOURAGE (warm, no-pressure close of the trial) → next trial
SESSION_END after N trials, or instantly via the always-visible stop button.
```

Implementation decisions beyond the original plan:

- **ENCOURAGE phase** added: when re-prompts are exhausted, the app plays a warm "that's okay, great sitting with me!" line and moves on. This makes "never dead-end in try-again" an explicit state rather than a convention.
- **Word images are emoji by default** (🍎 for apple) — offline, free, zero assets; caregivers can edit the word→emoji mapping in Settings.
- **First-attempt-wins fusion**: a `DetectionFuser` is armed only during LISTEN; the first channel to report wins, later reports in the same window are ignored.

## Audio capture

`getUserMedia` with `noiseSuppression: false`, `echoCancellation: false`, `autoGainControl: false`, mono 16 kHz — browser "cleanup" deletes exactly the quiet sounds we want. VAD is paused while any clip plays (gating instead of echo cancellation). Hot tuning: `positiveSpeechThreshold ≈ 0.3` (caregiver slider), `minSpeechFrames: 2`.

## Caregiver settings (persisted locally)

Name, target words (+ emoji), listen-window length, max re-prompts, trials per session, audio sensitivity, mouth sensitivity, camera channel on/off, sound on/off, voice choice (clips vs system voices).

## Data & progress

Per trial: timestamp, word, channel fired, latency to first attempt, re-prompt count, success. Stored in `localStorage` only; a Progress view shows per-session trends and a JSON export button for sharing with an SLP.

## Build phases

- **Phase 0** — scaffold, PWA, permission flow, clip-generation script. ✅
- **Phase 1** — MVP loop: voice + gated VAD + caregiver button + state machine + reward screen. ✅
- **Phase 2** — vision channel (jawOpen). ✅
- **Phase 3** — caregiver settings, logging, progress view. ✅
- **Phase 3.5** — researcher-style audio capture & review (designed below). Next.
- **Phase 4** — optional: Kokoro-82M in-browser, Whisper-tiny "getting closer" layer (additive only). Future.
- **Phase 5** — personalization: tiny classifier on his own sounds (Python → ONNX). Future. **Fed directly by the labeled clips from Phase 3.5.**
- **Phase 6** — packaging: PWA install now; Capacitor/Tauri wrap later, no rewrite.

## Phase 3.5 — Researcher-style audio capture & review (planned)

Record his vocalizations the way a researcher would — event-sampled, metadata-tagged,
labeled later — so a caregiver or SLP can interpret attempts after the session, and so
Phase 5 has a real training set.

### Capture: peri-event clips, not continuous recording

- During LISTEN, keep a **rolling ring buffer** (~5 s) of raw 16 kHz mic audio. The
  vad-web `onFrameProcessed` callback already delivers every frame, so this costs
  almost nothing.
- When **any** channel fires (audio, mouth, manual), persist a window around the
  attempt: ~3 s before through ~2 s after. This captures the sound even when the VAD
  was not the channel that detected it — silent mouthing with a faint sound, a
  caregiver tap on something the detectors missed. Those near-misses are exactly the
  audio worth studying (and the evidence for re-tuning sensitivity).
- Optional toggle: also save the full listen window on **timeout** trials, to audit
  what the detectors are failing to hear.
- Encode to WAV in a small worker; never block the UI.

### Metadata: a clip without context is noise

Each clip stores: sessionId, timestamp, target word, channel that fired (or `null`
on timeout), latency, re-prompt count — the same record as the session log, joined by
trial id.

### Review screen: SLP-style labeling

- List clips grouped by word / date; tap to play.
- Label each on the standard shaping ladder:
  `0 — no vocalization · 1 — any sound · 2 — approximation (right vowel / syllable count) · 3 — recognizable word`
  plus a free-text note.
- Labels feed two things: per-word progress trends ("apple is mostly 2s now"), and the
  Phase 5 supervised training set (export below).

### Storage, export, retention

- **IndexedDB** for WAV blobs (localStorage cannot hold audio); metadata stays in the
  trial log keyed by trial id.
- Visible storage usage; per-clip delete; delete-all; retention cap (default: newest
  ~200 clips, oldest evicted first).
- Export: a zip of WAVs + a CSV of metadata and labels — for the SLP, or as the
  labeled dataset for `tools/train_personal_model.py`.

### Consent & privacy posture

- Recording is **off by default**; enabled only in caregiver settings with a
  plain-language explanation.
- A small persistent 🔴 indicator is shown during sessions while recording is on.
- Everything stays on-device, as with all other data. He cannot consent in the usual
  way, so recordings are treated as **his data held in trust**: minimal retention,
  effortless deletion, never uploaded, export is a deliberate caregiver act.

## Improvement ideas (backlog, roughly by value)

1. **Caregiver-recorded prompts.** Let a parent record "Alex, can you say apple?" in
   their own voice — likely more salient than any TTS. The Phase 3.5 recording
   infrastructure doubles as the recorder; clips drop into `public/clips/`-equivalent
   IndexedDB slots that playClip checks first.
2. **Live calibration meter.** A settings screen showing real-time VAD probability and
   jawOpen score so the caregiver can watch what registers and tune by observation;
   a 10-second room-noise sample suggests a starting audio threshold.
3. **Reactive listening ring.** Make the breathing ring respond instantly to his sound
   level during LISTEN — immediate cause-and-effect even before the celebration.
4. **Real photos instead of emoji.** The caregiver photographs his actual ball/cup;
   personally meaningful, concrete images generalize better for many autistic
   learners. Stored in IndexedDB alongside the word list.
5. **Per-word shaping suggestions.** Once labels exist: "most attempts at *apple* are
   level 2 — consider celebrating only 1+ sounds for it" (always caregiver-decided,
   never automatic).
6. **Screen wake lock** during sessions so a tablet doesn't dim mid-listen.
7. **Reward variety per his preferences** — selectable celebration themes (stars,
   bubbles, a favorite character image), still slow and non-flashing.

## Testing

The engine (state machine, detection fusion, phrase picker) and data layer are pure logic, covered by vitest. Hardware layers (mic, camera, audio playback) are thin wrappers verified manually in the browser — see README "Trying it out".

## Safety, ethics & clinical notes

Involve an SLP where possible; respect AAC as a primary, valid path; sensory safety (gentle voice, no startling sounds, instant stop); privacy by design (nothing leaves the device); not a medical device.
