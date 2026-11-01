# Offline vocalization detection + "was it the child?" (browser PWA)

Scope: Vite + React PWA, onnxruntime-web (WASM/WebGPU), AudioWorklet, Android tablet / iPad, minimally verbal autistic child. Research date 2026-11-01. Items marked **[unverified]** were not confirmed from a primary source in this pass and must be measured on the target tablets.

## Bottom line

1. Detect "something vocal happened" with an **energy gate + Silero VAD v6 at a low threshold**, not with speech-only logic. VADs are trained on speech, so hums, squeals and soft "ah" are the weak spot. Treat VAD as a hint and keep a loudness/spectral fallback.
2. Do **not** rely on an off-the-shelf speaker-verification model to tell a child from a parent. The evidence says adult-trained embeddings degrade on children. Use a cheap **pitch + spectral-tilt cue** and **per-family enrollment** (a few parent clips plus child clips collected in-app), and treat the result as a soft score, never a gate that withholds reward.
3. This fits the app's "reward any attempt" principle. A wrong "parent" label should cost nothing. Default to rewarding, and use child-vs-parent only for logging and for ignoring clearly adult speech when the parent mutes the child.

## 1. Voice activity detection

| Option | Size / frame | Latency and cost | License | Notes for this use |
|---|---|---|---|---|
| Silero VAD v5/v6 ONNX | about 2-2.3 MB; 512 samples at 16 kHz (32 ms); v5+ also feeds 64 samples of context | Under 1 ms per chunk on one CPU thread (upstream claim) | MIT | Best-supported browser option. Sources: [silero-vad](https://github.com/snakers4/silero-vad), [v6 card](https://huggingface.co/openEuler/silero-vad), [wrapper models page](https://docs.vad.ricky0123.com/user-guide/models/) |
| Silero legacy (v4-era) | 1536-sample frame (96 ms) | Same cost, coarser timing | MIT | Only for back-compat in [@ricky0123/vad-web](https://docs.vad.ricky0123.com/user-guide/models/). The wrapper lists `legacy`, `v5`, `v6`. Legacy is still its default, v6 is recommended. |
| TEN VAD | WASM lib 277 KB (web); hop 160 or 256 samples (10 or 16 ms) | RTF 0.010 on M1 web; 0.049-0.057 on weak Android (J6+, A3s); claims faster speech-to-silence transitions than Silero | Apache 2.0 "with additional conditions" (read LICENSE before shipping) | Smallest and lowest latency, WASM build exists since June 2025. Numbers are self-reported: [TEN VAD](https://github.com/TEN-framework/ten-vad). No JS wrapper as mature as vad-web. |
| WebRTC VAD (GMM) | tiny, 10/20/30 ms frames | Negligible | BSD | Energy/spectral based, so it reacts to non-word sounds, but it is noisy and has poor precision in room noise. Useful as a cheap pre-gate. |
| pyannote segmentation 3.x | roughly 5.7 MB ONNX (sherpa-onnx export) **[unverified]** | 10 s windows, too heavy and too slow for live feedback | MIT weights, gated download | Offline diarization only. Not a live trigger. |
| 2025-26 newcomers | n/a | n/a | n/a | I found no newer lightweight VAD with browser support and independent benchmarks. Re-check before building. |

Known wrappers: `@ricky0123/vad-web` (Silero via onnxruntime-web, ships its own AudioWorklet) and `vad-react` (React hooks over it) **[latter unverified]**. Both are practical, but you will likely want to own the worklet so you can share the audio with the speaker/pitch stages.

**Quiet and non-word vocalizations.** I found no published evaluation of Silero or TEN on infant or autistic-child non-word vocalizations. The nearest evidence: infant vocalization work uses cry/fuss/babble/laugh/screech categories and trains dedicated detectors ([review](https://arxiv.org/pdf/2509.18235), [SSL models on infant vocalizations](https://arxiv.org/pdf/2402.06888)), and speech-trained models transfer imperfectly. Expect Silero to miss soft breathy sounds, hums and some squeals, and to fire on non-speech noise (TV, music). Mitigations: lower the speech threshold (start around 0.3 instead of 0.5, per-child tunable), shorten the minimum speech duration (about 100 ms), and OR the result with an RMS-over-noise-floor gate and a voicing detector (pitch present).

## 2. Speaker embedding / verification

| Model | ONNX size | License | Notes |
|---|---|---|---|
| WeSpeaker ResNet34 (VoxCeleb) | 26.5 MB | Apache 2.0 | [sherpa model mirror](https://huggingface.co/csukuangfj/speaker-embedding-models/tree/main) |
| WeSpeaker CAM++ (VoxCeleb) | 29.3 MB | Apache 2.0 | same listing |
| 3D-Speaker CAM++ (en VoxCeleb) | 29.6 MB | Apache 2.0 | same listing; CAM++ paper reports 0.73% EER on VoxCeleb-O with less compute than ResNet34/ECAPA ([arXiv 2303.00332](https://arxiv.org/abs/2303.00332v3)) |
| 3D-Speaker ERes2Net | 26.5-221 MB | Apache 2.0 | Larger variants too heavy |
| SpeechBrain ECAPA-TDNN | about 80 MB fp32 **[unverified]** | Apache 2.0 | Original [paper](https://arxiv.org/pdf/2005.07143). Larger than needed. |
| NeMo TitaNet-small | about 25 MB **[unverified]** | CC-BY-4.0 | ONNX export possible; no browser track record |
| pyannote embedding | about 17 MB **[unverified]** | gated | Skip. |

I could not find browser inference timings for any of these. Plan on tens to low hundreds of ms for 1-2 s of audio on WASM for the 6-7M parameter ResNet34/CAM++ class, and measure on the real tablet. **[unverified]** Quantize to int8 to land near 7-8 MB.

**Child evidence (the important part).**
- Adult-trained extractors see roughly 40-45% relative EER increase on children, and error shrinks with age, because older children sound more adult ([ChildAugment](https://arxiv.org/html/2402.15214v1), [age-agnostic SV](https://arxiv.org/html/2508.01637v1), [classroom SV](https://arxiv.org/pdf/2505.20222)).
- Fine-tuning ECAPA on classroom child data cut EER by 38-48% relative ([FT-Boosted SV](https://arxiv.org/pdf/2505.20222)).
- For infant cries, ECAPA fine-tuned on CryCeleb reaches 25.8% EER versus 0.87% on VoxCeleb ([review](https://arxiv.org/pdf/2509.18235)). That is the best proxy for non-word vocalizations and it is poor.
- Short segments (0.3-1 s) degrade every embedding model; I found no child-specific number. Non-word sounds ("ah", hum) carry little speaker-specific phonetic content.

Conclusion: speaker verification is not a dependable "is this the child" signal here. Use it only as a **parent-vs-everyone-else** test: enroll the parent (adult speech suits these models well, 3-10 s of read speech), and flag segments whose similarity to the parent is high as "parent". Do not try to verify the child directly. Fine-tuning on the child is out of scope (no data, offline).

## 3. Cheap complementary cues

| Cue | Values | Source |
|---|---|---|
| Child mean F0, ages 4-8, conversational | about 255-277 Hz (range 203-329) | [Sydney Voice Lab norms](https://www.sydney.edu.au/content/dam/corporate/documents/faculty-of-medicine-and-health/research/research-centres/sydney-voice-lab/acoustic-analysis-normative-data-reference-sheet-20250416_v4.0-sydney-voice-lab.pdf.coredownload.pdf) |
| Child F0, age 3 / 5 / 7 | about 270-320 / 250-270 / 255-260 Hz (n=4 per age) | [Mueller & Wilson 1978](https://cjslpa.ca/files/1978_HumComm_Vol_03/No_03_123-199/Mueller_Wilson_HumComm_1978.pdf) |
| Adult male / female | about 115 / 199 Hz | same Sydney sheet |

Pitch separates a child from an adult **man** very well (about 2.3x). Against a **mother** (about 200 Hz, SD 28, with range roughly 160-260 Hz in expressive "motherese", which runs higher) there is overlap, especially for older children and when a parent speaks in a raised, child-directed voice. Autistic children also show atypical, sometimes very high or variable pitch (I have not cited a source for this, treat as general knowledge). So pitch alone: strong against dads, unreliable against moms. Use it as one feature: F0 median above about 250 Hz leans child, below about 180 Hz leans adult, between is "unknown".

F0 estimators for JS:

| Estimator | Size / cost | Notes |
|---|---|---|
| YIN / pYIN | a few dozen lines of JS, microseconds | Cheapest; octave errors on breathy or very high sounds. Run on 16 kHz at 20-30 ms windows, limit search to 80-1000 Hz. |
| SwiftF0 | 95,842 params (small ONNX), reportedly about 42x faster than CREPE on CPU, 91.8% HM at 10 dB SNR, range 46.9-2093.75 Hz | [paper](https://arxiv.org/pdf/2508.18440), has a client-side WASM demo. Best neural option; covers child range well. |
| CREPE tiny | about 0.5 MB ONNX **[unverified]** | Heavier and slower than SwiftF0. |

Add spectral cues as well: formant-ish spectral centroid or tilt, and voicing ratio. Both are nearly free once you have an FFT.

## 4. Browser audio pipeline

- **Capture:** `getUserMedia({audio:{channelCount:1, echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`. Browser noise suppression and AGC can gate soft sounds and pump levels, which is the exact failure for quiet child sounds ([secondary source](https://pub.dev/documentation/flutter_recorder/2.0.0/)). Do your own gain normalization and noise floor. Echo cancellation off means the app's own audio will be heard, so duck or gate detection during app playback, or use a short blanking window after playback. Constraint support differs between Safari and Chrome, so read back `track.getSettings()` on device **[unverified]**.
- **Rate:** Request a 16 kHz `AudioContext` where honored, otherwise resample in the worklet (simple polyphase or linear is fine for VAD/F0). Frame to 512 samples for Silero.
- **Worklet to main:** AudioWorklet posts 512-sample chunks via `postMessage` (cheap at 31 msg/s). A SharedArrayBuffer ring buffer needs cross-origin isolation (COOP/COEP headers), and is not worth the deployment risk for a PWA at these data rates. Skip it.
- **onnxruntime-web:** Multi-threaded WASM only works under cross-origin isolation; `numThreads` defaults to min(4, cores/2), and 1 disables threads ([ORT docs](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)). Silero and ECAPA-class models are small, so run **single-thread WASM** and avoid the headers requirement. `wasm.proxy` (worker) cannot be combined with WebGPU.
- **WebGPU:** Shipped by default on iOS/iPadOS 26 per a [secondary list](https://appdevelopermagazine.com/WebGPU-in-iOS-26/), while ORT's WebGPU backend is still marked experimental on [npm](https://npmjs.com/package/onnxruntime-web). Not worth it for models this small; WASM CPU is predictable.
- **iOS PWA mic permission:** Home-screen web apps have historically failed to persist mic/camera permission across sessions or navigations ([WebKit bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884)). Current status unknown, so test on the target iPadOS. Mitigate with a single long-lived `MediaStream`, no route-level reloads (single-page app), and a clear tap-to-start screen. Settings > Safari > Microphone can be set to Allow by the parent as a fallback.

## Recommended stack

| Stage | Choice | Size | Latency |
|---|---|---|---|
| Capture | getUserMedia, all processing off, AudioWorklet 16 kHz mono, postMessage | 0 | 32 ms frames |
| Gate | RMS over adaptive noise floor | 0 | per frame |
| VAD | Silero v6 ONNX via ORT-web WASM, single thread, threshold about 0.3 | about 2.3 MB | about 32-64 ms to onset (plus ORT overhead) |
| Pitch | JS YIN first, SwiftF0 ONNX if YIN proves noisy | 0 or about 0.3 MB | under 5 ms |
| Parent flag | WeSpeaker CAM++ or ResNet34, int8, parent enrollment only, run only on finished segments of at least 0.5 s | about 8 MB (int8) / 27-29 MB (fp32) | 100-300 ms after segment end **[estimate]** |
| Decision | Weighted soft score of F0 and parent similarity; default reward | n/a | n/a |

Total payload: about 3 MB without the embedding stage, about 11 MB with it, all cacheable by the service worker for fully offline use.

## Risks

- **Misses on soft or non-word sounds.** Mitigate with the energy+pitch OR-gate and per-child threshold calibration in the parent area.
- **Child-vs-mom confusion.** Pitch overlap and weak child embeddings. Never penalize or withhold; log only.
- **Speaker model licenses/gating.** WeSpeaker and 3D-Speaker are Apache 2.0, TEN VAD has extra conditions, pyannote weights are gated. Read each LICENSE before bundling.
- **No benchmark on this population.** Everything about autistic non-word vocalizations is extrapolated. Budget a small on-device validation session with real recordings (parent consent) before trusting any threshold.
- **iOS PWA quirks:** mic permission, AudioContext start-on-gesture, background suspension. Test on a real iPad.
- **App audio feedback loop** with echo cancellation off. Needs a playback blanking window.
