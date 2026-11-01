# 03 - Offline closeness scoring for 0.3-2 s child utterances

Goal: suggest a level (sound / close / word) for a minimally verbal child's attempt at "ba", "more", "bubbles". Additive only: the reward fires regardless; the level just picks the praise/log label. Everything runs in-browser, offline.

Confidence note: sizes marked (~) come from search snippets and model cards I could not open in full; verify before shipping.

## 1. Browser-runnable models

| Option | Size (~) | Latency | License | Fit for 0.3-2 s child utterances |
|---|---|---|---|---|
| [sherpa-onnx WASM](https://k2-fsa.github.io/sherpa/onnx/wasm/index.html) (Zipformer/Paraformer demos; VAD + KWS also exist) | Streaming Zipformer en int8: encoder ~71 MB + 1.6 MB ([2023-06-26](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26/tree/6037ea07e3abfe599ad00d418968bcf9656e7472)). A [20M English variant](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html) exists (size not verified; likely ~20-40 MB int8). | Real-time factor well under 1 on WASM CPU | Apache-2.0 | Good engine; word text only, poor on child/atypical speech. Best "small ASR" candidate if the 20M model is <=30 MB. |
| Whisper tiny/base via [transformers.js](https://huggingface.co/docs/transformers.js) | tiny q8 ~45 MB, q4 ~15 MB; base q8 ~85 MB, q4 ~40 MB ([ref](https://micdrop.dev/docs/ai-integration/provided-integrations/whisper)) | ~300-450 ms per 3 s (q8, desktop); WebGPU faster but optional | MIT | Hallucinates on silence/non-speech ([thread](https://community.openai.com/t/hallucination-on-audio-with-no-speech/324010)); fixed 30 s window wastes compute. Risky for "sound" attempts: it invents words. |
| [Moonshine tiny](https://github.com/usefulsensors/moonshine) | ONNX parts ~30+120+7 MB (+127 MB uncached decoder); [streaming tiny ~34 MB](https://lemonade-server.ai/docs/guide/configuration/moonshine/) | Variable-length input, fast on 1 s clips | MIT ([web copy](https://huggingface.co/RabiatS/moonshine-tiny-web)) | Better latency profile than Whisper for short clips; still word text only. |
| wav2vec2 phoneme: [lv-60-espeak-cv-ft ONNX](https://huggingface.co/sadda-speech/wav2vec2-espeak-ctc), [TIMIT XLS-R int8](https://huggingface.co/robg/speako-phoneme-recognizer) | ~300-390 MB (int8 355 MB; fp16 larger) | ~1-3 s per clip on WASM; sub-second on WebGPU (estimate) | Apache-2.0 | Only family that outputs phones (IPA, 392 tokens), so closeness is natural. Too big as default; optional pack. allosaurus has no browser build. |
| [Vosk small en-us 0.15](https://huggingface.co/rhasspy/vosk-models/commit/7a93adc8fc06b2dd1fa16806f8f8c6d1c8928c2a) | 41 MB | Fast | Apache-2.0 | Reported "rather poor" vs Whisper ([issue](https://github.com/alphacep/vosk-api/issues/1644)). Skip. |
| Kaldi GOP pipelines | Hundreds of MB, no maintained WASM | - | Apache-2.0 | Not practical in browser. |

## 2. Child and atypical speech

- Off-the-shelf ASR degrades by roughly an order of magnitude on children ([arXiv 2502.08587](https://arxiv.org/pdf/2502.08587)); errors follow predictable phonological processes ([Disney Research](https://la.disneyresearch.com/publication/evidence-of-phonological-processes-in-automatic-recognition-of-childrens-speech/)). For 2-5 year olds and minimally verbal children expect near-zero word recognition from any small model.
- [Kid-Whisper](https://ojs.aaai.org/index.php/AIES/article/view/31618): fine-tuning on MyST cut WER 13.9% to 9.1% (small) and 13.2% to 8.6% (medium). That is school-age classroom speech; no tiny/ONNX export found. A [Whisper tiny.en child fine-tune](https://arxiv.org/abs/2507.14451v1) reached 15.9% WER (ages 8-11), +11% relative after compression, on a Raspberry Pi with thermal throttling.
- Disordered speech: [Google on-device personalization](https://ar5iv.labs.arxiv.org/html/2106.10259) raised task success from 40% to 81% only after per-speaker adaptation.
- Apraxia therapy game ([Apraxia World](https://psi.engr.tamu.edu/portfolio/childhood-apraxia-of-speech/)): ~75.8% mean utterance accuracy; phoneme-level error ID ~60% in related work; caregivers judged leniently.
- Conclusion: transcripts are the wrong primitive for this user. Prefer acoustic similarity to a known target, calibrated per child.

## 3. Scoring methods

| Method | Needs | Works for 0.3-2 s approximations? | Cost |
|---|---|---|---|
| Phoneme edit distance vs target | Phone recognizer (wav2vec2) + G2P ([cmudict JS](https://www.npmjs.com/package/cmu-pronouncing-dictionary) or [espeak-ng WASM](https://github.com/espeak-ng/espeak-ng)) | Principled, but recognizer is unreliable on child phones; "ba" yields noisy output | 300+ MB |
| GOP from CTC posteriors | Same wav2vec2 CTC; target-phone log-posterior vs best competitor | Softer and more graded than hard edit distance; CTC peaky timing hurts 1-2 phone words | 300+ MB |
| DTW on MFCC/log-mel vs reference | Reference clip (parent recording, TTS) | Best cheap method for very short items: no vocabulary or LM, personalizes to the child's voice. Weak across speakers (adult vs child pitch/formants); mitigate with CMVN, deltas, and **child-self templates** (past accepted attempts) | ~1 KB/clip, ms |
| Heuristics: voiced duration, syllable count (energy peaks), onset class (burst, ZCR, low-freq energy), vowel class (F1/F2 via LPC) | Plain DSP in JS/AudioWorklet | Mirrors SLP hierarchies: vocalization, vowel, CV approximation, syllable/word shape, whole word | tiny |

Practical read: DTW plus heuristics covers "sound" vs "close"; model-based phone scoring adds marginal gain for "word" at large download cost.

## 4. Existing apps / prototypes

No published on-device accuracy found for Speech Blubs, Jabberwocky or Otsimo (searches returned nothing; they appear to lean on video modeling and reward rather than scoring). Closest evidence: Apraxia World (ASR + lenient caregiver judging, ~75.8%), Qatar CAS phoneme detection (92.7% utterance-level, ~60% phoneme-level), Google personalization above. Common pattern: lenient thresholds, speaker adaptation, human in the loop.

## 5. Recommended tiered approach

**Tier 0 (always on, ~0 MB, <50 ms):** Web Audio RMS gate/VAD. Compute voiced duration, energy-peak syllable count, onset class, spectral/formant vowel hint. "sound" = any voiced vocalization >=150 ms; "close" = syllable count matches and onset or vowel class matches. Always rewards.

**Tier 1 (default, <1 MB per item):** DTW (Sakoe-Chiba band) on 13 MFCC + deltas with CMVN against a template bank per target: parent-recorded clips (preferred), the child's own accepted attempts (grows, adapts), TTS fallback. Score = min normalized DTW distance; thresholds are **per-child percentiles** from the first N attempts, not absolute. Promote to "word" only when distance is in the child's best quartile AND syllable count matches. Expected ~70-85% agreement with a lenient parent/SLP on sound-vs-close for a handful of targets (extrapolated from small-vocabulary DTW literature and the ~75% apraxia-game figure; validate by having the parent label attempts).

**Tier 2 (optional pack, 20-45 MB):** sherpa-onnx Zipformer 20M or Moonshine tiny streaming, run only on Tier 1 "close" candidates; promote to "word" if the transcript fuzzy-matches the target (Levenshtein on cmudict phones). Hard rule: ignore output unless Tier 0 saw voiced audio; drop known hallucination strings. Mainly for older or more verbal kids.

**Tier 3 (optional, 300+ MB, WebGPU only):** wav2vec2-espeak CTC GOP against target phones, shown to the parent as diagnostics only. Never gates, never downloaded by default.

Cache models via service worker/OPFS; ship ORT-web WASM locally (SIMD + threads need COOP/COEP headers; verify hosting).

## 6. Risks

- False negatives are the real harm: demoting a real attempt feels like failure. Keep a "sound" floor for any voiced audio plus a parent override.
- Whisper-family hallucination on non-speech; never primary.
- Adult-to-child DTW mismatch; child templates fix it but need warm-up (early sessions lenient by design).
- Room noise, TV, siblings: VAD and SNR floor needed or Tier 0 rewards the room.
- Device variance: WebGPU absent on many tablets; iOS Safari WASM threads; thermal throttling on small models.
- Privacy: keep audio ephemeral; store only feature vectors if anything (fits offline-only constraint).
- Unverified: exact 20M zipformer size, Moonshine streaming license, Speech Blubs/Jabberwocky/Otsimo internals.
