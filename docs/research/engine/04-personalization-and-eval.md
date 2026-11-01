# 04 - Personalization and evaluation of the attempt detector

Scope: one child, offline, in-browser. Goal: the detector gets better on-device, and we can prove it. Confidence tags: [V] seen in a source this session, [K] general knowledge, not re-verified.

## 1. On-device personalization

**Principle.** Do not retrain the encoder. Keep a frozen, shipped embedding model (or our existing hand-built features) and adapt only a tiny head plus thresholds. That is the pattern in every credible system found.

- **Apple "Hey Siri"** [V]: speaker-independent trigger detector first, then an on-device speaker check. Enrollment = 5 utterances -> 5 stored speaker vectors; verify by averaging scores against a threshold; later add real-world utterances implicitly. https://machinelearning.apple.com/research/personalized-hey-siri . Same two-stage shape in the 2020 Personalized Voice Trigger Challenge (mean of 3 enrollment embeddings): https://arxiv.org/pdf/2101.01935 . Take-away: generic gate -> cheap personal re-scorer; profile = small bag of vectors.
- **Few-shot KWS** [V]: prototype/triplet encoders with a prototype head reach ~76% in 10-shot with 5% false-accept on unknown speech (Rusci & Tuytelaars, Interspeech 2023): https://arxiv.org/pdf/2306.02161 . Follow-up on post-deployment self-learning for personalized KWS: https://www.arxiv.org/pdf/2408.12481 . Prototypical nets for few-shot KWS: https://arxiv.org/pdf/2007.14463 . Lesson: normalized embeddings plus explicit "unknown" handling matter more than head complexity; ~10 examples per class is the useful floor, 20-50 comfortable [K].
- **Browser options.** (a) TF.js speech-commands `createTransfer` collects examples and trains a small dense head with a Noise class: https://www.npmjs.com/package/@tensorflow-models/speech-commands , codelab https://codelabs.developers.google.com/codelabs/tensorflowjs-audio-codelab [V]. (b) onnxruntime-web training exists since ORT 1.17, CPU/WASM only, single-threaded, needs offline-prepared training artifacts: https://opensource.microsoft.com/blog/2024/02/06/on-device-training-training-a-model-in-browser [V]. Both are heavy for what we need.
- **Recommendation (lazy path):** head = per-class mean prototype (or L2-regularised logistic regression, ~20 lines, a few hundred SGD steps on <=500 vectors, runs in ms) over fixed features. Store prototypes, per-class cosine thresholds, and a negative set (parent voice, TTS, room). No TF.js/ORT until the frozen encoder is a neural net, and even then train the head in plain JS [K].
- **Per-child gains in the literature.** ReCANVo: 8 minimally speaking communicators, >7,000 vocalizations labelled in real time by a family member: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10404278/ ; thesis https://dspace.mit.edu/handle/1721.1/140101 . Per-person models beat chance on function classification [V]; a student project reports F1 0.793 for the best participant with HuBERT + one dense layer but much worse for others, and models trained on ReCANVo generalised poorly to a Portuguese-speaking context (secondary sources) [V, weak]. LENA generic classifiers are weak on child events (cry F1 ~0.17 vs ~0.63 for a purpose-built model; ~18% false alarm on child-speech tags): https://talkbank.org/homebank/access/0docs/micheletti2022.pdf , https://arxiv.org/pdf/2005.07036v4 . Implication: personal beats generic, but expect high variance and dominant-class bias.
- **Drift control** [K]: (1) freeze the shipped model; only the head moves. (2) Prototype update = EMA with small rate, only from confirmed, high-margin clips. (3) Cap per-class exemplar store (e.g. 100, diversity via farthest-point replacement); never learn from unlabeled auto-accepts. (4) Keep a **pinned anchor set** (first-week confirmed clips); an update must not drop anchor recall or raise FA/min beyond tolerance, else roll back. (5) Version heads; keep the previous for one-tap revert. (6) Thresholds may only move within a clamp around the calibrated value.

## 2. Labels without burden

- ReCANVo's protocol is the proof of concept: a caregiver labels in the moment with context the audio lacks [V]. Our one-tap set (looked / reached / sound / close / word) is the same idea; a tap labels the preceding N seconds of a ring buffer, not a live annotation.
- Treat taps as **weak, noisy, delayed**: store `tapTimeMs`, clip start/end, label, `source: "tap"`. Asymmetric: a tap on a miss is a strong positive; no tap is not a negative.
- **Ask when unsure** [K]: prompt only for clips scoring in an uncertainty band around the threshold, max 3 per session, never mid-activity - queue to a post-session "Did Alex try?" review (yes / no / not sure). Uncertainty-only selection biases toward edge cases, so mix in 1 random clip in 4 (hybrid; see few-shot active learning, https://arxiv.org/pdf/2201.05151 ).
- **Noise handling** [K]: "not sure" is a first-class abstain; weight labels (live tap 1.0, review 0.7); drop a label that disagrees with 3+ nearest labelled neighbours and re-ask once; require >=2 confirmations before a prototype may move more than the EMA step; maintain a negative bank from review "no" answers plus an explicit "record the room / my voice" enrollment step.

## 3. Evaluation methodology

**Metrics for "reward any attempt"** (asymmetric: a miss is costly, a false reward is cheap but erodes meaning):
1. **Attempt recall** per vocalization type (vowel, babble, word approximation, hum); event-level match with onset within +-300 ms.
2. **False-accept rate per minute**, per negative kind: parent speech, TTS (our own prompts), TV, room noise, handling thuds. Report FA/min, not precision.
3. **Latency to fire**, onset to reward callback; p50/p95; target p95 < ~400 ms [K].
4. **Stability**: same session replayed after each update (regression), anchor-set recall.
5. Operating point: choose threshold at FA/min <= target (e.g. 0.5/min on parent voice), then maximise recall; also publish the recall vs FA/min curve.

**Corpus (replayable sessions).** Per session: 16 kHz mono 16-bit WAV (engine rate) plus sidecar JSON:
`{id, schema, sampleRate, startedAt, device, appVersion, engineVersion, thresholdPreset, noiseFloorDb, events:[{t0,t1,label,source:"tap|review|annotator",confidence}], negatives:[{t0,t1,kind:"parent|tts|tv|room|handling"}], consent:{ts,scope,retentionDays}, notes}`.
Keep whole-session clips, not only events - FA/min needs the quiet time. Second-pass annotation on a waveform tool; record disagreement.

**Public fixtures** (negatives/stress, not tuning to Alex):
- ReCANVo (check licence on the paper page): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10404278/
- HomeBank/TalkBank incl. deBarbaro cry corpus (gated, citation required): https://homebank.talkbank.org/access/Password/deBarbaroCry.html , https://homebank.talkbank.org/projects.html
- Infant-parent corpus (cry/fuss/laugh/babble), Interspeech 2018: https://www.isca-archive.org/interspeech_2018/xu18c_interspeech.pdf
- Noise: ESC-50 https://github.com/karolpiczak/ESC-50 ; MUSAN https://www.openslr.org/17/ ; DNS Challenge https://github.com/microsoft/DNS-Challenge [K, not re-fetched]. Baby Chillanto: availability/licence not confirmed - unverified.

**Augmentation**: noise mix at SNR {20,10,5,0} dB; RIR convolution (OpenSLR 26/28 or recorded) [K]; gain jitter +-12 dB; clipping; DC offset; 44.1/48 kHz -> 16 kHz resample path (browsers may deliver either). Seeded PRNG; commit recipes/seeds, not audio.

## 4. Calibration UX (mostly [K]; shipped-app specifics NOT verified)

What tends to work for non-technical parents: (1) "Be quiet for 5 seconds" measures the floor and sets threshold = floor + margin automatically, ending in one green/amber/red verdict; (2) a live bar meter with a visible threshold line and words ("quiet room / lots of noise"), no dB; (3) three presets (Quiet / Normal / Noisy) as offsets on the calibrated value, plus "too many rewards / missing tries" nudge buttons instead of a slider; (4) a **"what did the mic hear" list**: last ~10 triggers and near-misses as playable 3 s clips with thumbs up/down - this doubles as the label source in section 2. Hearing-aid and baby-monitor apps use similar ingredients (scenes, sensitivity levels, sound-event logs) [K]; LENA is report-only with no live feedback [K]. Hand-check Speech Blubs and Otsimo before copying; their mic UX could not be confirmed.

## 5. Privacy and retention

- IndexedDB (Blob + metadata stores), never uploaded; call `navigator.storage.persist()`, handle quota errors [K].
- Retention: unreviewed audio only in an in-memory ring buffer (<=60 s); kept clips capped (e.g. 200 or 30 days, whichever first); default **off** for keeping audio, with an embeddings-only mode (still voice-identifying, so not anonymous).
- Delete-all that really wipes clips, embeddings, heads, labels; per-clip delete; export-to-zip behind a deliberate tap.
- Consent language (child cannot consent): the parent/guardian agrees on the child's behalf and in the child's interest; say plainly what is saved, that it stays on this device, that clips can be played back and deleted any time, and that nothing leaves unless exported. No claims of anonymity. Sharing with therapists/researchers needs separate written consent. Not legal advice; check COPPA/GDPR-K wording if ever distributed.

## 6. Recommended learning loop

1. **Data**: ring buffer -> candidate events from the existing detector -> features/embedding -> stored with clip if opted in.
2. **Labels**: live tap -> post-session review of uncertain + 1-in-4 random clips -> weighted labelled set.
3. **Update**: at session end, rebuild prototypes and thresholds from labelled exemplars (batch and deterministic - easier to test than online SGD), clamp, version.
4. **Gate**: replay the pinned anchor set and frozen negatives through candidate vs current head (same code as vitest, run from a debug route). Promote only if recall >= current - 2 pts and FA/min <= current; else keep old.
5. **Report**: parent-facing "Alex's tries caught this week"; dev-facing metrics JSON.

## 7. Harness design (Node/vitest)

```
fixtures/
  sessions/<id>.wav + <id>.json    schema above; real ones gitignored, synthetic committed
  synth/recipes.json               noise, RIR, SNR, seed
src/engine/eval/
  readWav.ts    16-bit PCM parser, no deps (~30 lines)
  replay.ts     feed 20 ms frames into the REAL detector; clock = sampleIndex / sr
  score.ts      match detections to events -> recall, FA/min per negative kind, latency p50/p95
  augment.ts    mix(noise, snr), convolve(rir), gain, resample; seeded PRNG
tests/eval.spec.ts
  - per session: recall >= floor, FA/min <= ceiling (budgets.json)
  - metrics JSON snapshot, diffed in PRs
  - augmentation sweep: recall at 10 dB SNR >= X
  - determinism: same input twice -> identical detections
  - update gate: candidate head vs anchor set
```
Key rule: the engine takes time from the sample stream, never `Date.now()`, so a WAV replays bit-identically in Node and in the browser. Latency is stream-time; add one real-time browser smoke test for audio-worklet overhead.

## 8. Risks

- **Tiny N**: one child, few events; per-class thresholds overfit. Clamp, bootstrap CIs, refuse to report recall with <30 events.
- **Label bias**: taps follow salient events; quiet attempts are under-labelled, so measured recall is optimistic. Periodically annotate random segments blind.
- **Feedback loop / drift**: rewarded sounds become more frequent, shifting the data; the pinned anchor set is the only fixed ruler.
- **Parent/TTS leakage** into positives via sloppy review taps; test FA on our own TTS output directly (we know its waveform).
- **Dataset mismatch**: public corpora differ in speakers, mics, language; use for stress only (ReCANVo itself generalised poorly across contexts [V, weak]).
- **Consent/retention**: real child audio in a git repo is a liability; keep real fixtures out of git.
- **Unverified here**: Speech Blubs/Otsimo/baby-monitor UX, Baby Chillanto, exact ESC-50/MUSAN/DNS URLs, several F1 figures (secondary sources).
