# AlexSpeak attempt engine — design from the research

**Date:** 2026-11-01. Synthesis of the four research notes in this folder
(01 VAD & speaker, 02 vocalization science, 03 closeness scoring, 04 personalization &
evaluation). Each note marks which claims were verified and which are general knowledge.

## What the research changed

The naive plan was "detect a voice, check it's the child by pitch/speaker-ID, score how
close". Two of those steps are unsafe for this population:

- **Child verification doesn't work.** LENA mislabels ~37 % of autistic 5–8-year-olds'
  utterances as *adult*; its agreement with humans is 23 % for minimally verbal children.
  Adult-trained speaker embeddings lose ~40 % accuracy on children; infant-cry verification
  sits at ~26 % EER. Pitch separates a child from a father, not from a mother
  (child ≈ 255–277 Hz, mothers ≈ 200 Hz). → **Never gate on "is this the child".**
- **ASR is the wrong tool for closeness.** Whisper hallucinates on non-speech; child-speech
  WERs (9–16 %) are for typical talkers only; the best autistic-vocalization classifiers
  reach UAR ≈ 65 % and ROC-AUC ≈ 0.66. Cross-person transfer in ReCANVo worked for 2 of 8
  people. → **Per-child, heuristic-first, and always additive.**

So the engine flips the question: instead of proving the sound *is* the child, it removes
the sounds we *know* are not — the app's own voice and the enrolled parent — and treats
every other human vocalization as an attempt. Recall first; the parent's hold button stays
the ground truth.

## The pipeline

```
mic (16 kHz, EC/NS/AGC off) → AudioWorklet ring buffer
  → [1] Silero VAD v6 (2.3 MB, ~0.3 threshold) OR energy gate      "a voice happened"
  → [2] subtract known adults: TTS window + 400 ms; parent prototype  "not the app, not the parent"
  → [3] ATTEMPT fires (≤150 ms after voicing)                          reward now
  → [4] closeness tiers, async, after the reward                       suggest a rung chip
  → [5] log segment + features + parent's rung tap                     per-child learning
```

1. **Voice detection.** Silero VAD v6 via onnxruntime-web, single-thread WASM (no
   SharedArrayBuffer/WebGPU needed at this size), threshold lowered to ~0.3 and OR-ed with
   the existing energy gate so soft hums and squeals (Silero's known weak spot) still count.
2. **Known-adult subtraction, not child verification.** A small speaker-embedding model
   (WeSpeaker CAM++ int8, ~8 MB) is used only on *adult* voices, where it is accurate: the
   parent enrols with ~10 s at setup; a segment within the parent's cosine radius is
   dropped. The app's TTS is gated by time (already built). Optional father-vs-child pitch
   gate when the parent's F0 < 160 Hz.
3. **Fire.** One attempt per wait, fused with touch and the hold button (already built).
4. **Closeness, three tiers, never a gate.**
   - Tier 0 (0 MB): voiced duration, syllable count from energy peaks, onset class
     (vowel / bilabial / other), vowel hint from formants → `sound` vs `close`.
   - Tier 1 (0 MB): DTW on MFCC against two templates — the parent's recorded version of
     the word and the child's own best past attempt — with per-child percentile thresholds
     → `close` vs `word` suggestion. Estimated 70–85 % agreement with a lenient parent.
   - Tier 2 (optional, 20–45 MB): sherpa-onnx Zipformer-20M or Moonshine-tiny on `close`
     candidates only, for phoneme edit distance. Off by default.
5. **Learning this child.** Models stay frozen. Only per-child values adapt, in plain JS:
   VAD threshold, parent radius, Tier-0/1 percentiles, and a prototype per target word.
   Labels come from the rung chips the parent already taps (optionally a 30-second
   post-session "which of these were Alex?" review mixing uncertain and random clips).
   Drift control: a pinned anchor set of clips, versioned parameter sets, and
   promote-only-if-not-worse on the harness.

## How we know it's good

A vitest harness (`npm run engine:eval`) replays WAV fixtures through the real engine with
the clock driven by the audio samples, so runs are identical. Metrics: **attempt recall**
on child clips, **false accepts per minute** by negative type (parent voice, TTS, room
noise, silence), and **latency to fire**. Fixtures: on-device session clips (recording is
opt-in, 5 s around each attempt, capped, delete-all), augmented with MUSAN/DNS noise and
room impulse responses; ReCANVo for cross-checks. Every engine change ships with the
numbers.

## Parent-facing

Set up gets a 10-second room-noise calibration and the parent enrolment ("say a few words
so Alex's app can tell your voice from his"); the existing quiet / normal / loud presets
become the calibrated starting point. A "what the mic heard" list (last 10 segments with
play / "that was Alex" / "that was me") doubles as the labelling UI.

## Privacy

Everything on-device. Audio is kept only when the parent turns recording on, 5 s per
attempt, newest-200 cap, visible storage, one-tap delete-all. The child cannot consent, so
the data is held in trust: minimal, deletable, never uploaded; export is a deliberate act.

## Build order

| Phase | Adds | Size | Done when |
|---|---|---|---|
| A | Silero VAD + energy OR, harness + first fixtures, sample-clock replay | +2.3 MB | recall and FA/min reported on ≥ 30 clips |
| B | Parent enrolment + known-adult subtraction, "what the mic heard" list | +8 MB | parent can sing along without false accepts |
| C | Tier 0 + Tier 1 closeness, rung pre-select, per-child percentiles | 0 MB | ≥ 70 % agreement with parent rung taps |
| D | Anchor set, versioned params, promote-if-not-worse, post-session review | 0 MB | engine improves week over week on the harness |
| E | Optional Tier 2 model behind a setting | +20–45 MB | only if C plateaus |

## Risks to carry

- No published F0/duration norms for this population; thresholds must come from this child.
- iPadOS mic-permission persistence in an installed PWA is poorly documented; test on device.
- Embedding inference time in WASM is unmeasured; Phase B must benchmark before shipping.
- The engine is assistive: expected accuracy is modest, and the design keeps the parent's
  confirmation as the authority.
