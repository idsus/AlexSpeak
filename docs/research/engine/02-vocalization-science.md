# 02 - Vocalization science for minimally verbal autistic children (ages ~3-8)

Scope: how vocalizations are classified, their acoustics, what "closer to the word" means clinically, and privacy posture. Items marked **[unverified]** came from search snippets, memory, or secondary sources, or were not found.

## 1. How researchers classify these vocalizations

**LENA.** Key-child segments are sub-classified into speech-like vocalizations, cry and vegetative sounds. Only speech-like sounds count toward the Child Vocalization Count (CVC); laugh, cry, burp and breath are excluded, and a "vocalization" must be at least 0.6 s ([LENA support](https://lena-home-support.screenstepslive.com/m/92474/l/1408418-child-vocalizations)). It was validated on typical toddlers (up to ~48 months), with ~86% child-segment agreement with human judges ([VanDam 2013](https://www.lena.org/wp-content/uploads/2016/07/VanDam2013.pdf)). [Cristia 2020](https://bergelsonlab.com/files/publications/Cristia2020_Article_AThoroughEvaluationOfTheLangua.pdf) found CVC comparatively good but other LENA measures weaker.

**LENA fails on autistic children** ([Autism Research 2019, PMC6988897](https://pmc.ncbi.nlm.nih.gov/articles/PMC6988897)):
- Minimally verbal, n=24, ages 5.4-18.4: mean agreement with human transcribers **23%** (range 0-100%). Agreement fell with age (r = -0.68). Ages 5-8 vs >14: 56% vs 11% of utterances correct.
- Clinic/home sample, n=36, ages 5-17: agreement **42%**; 54% of target-child utterances missed; ~28% of child utterances labeled adult.
- Ages 5-8 errors: ~37% labeled "other child", ~37% "adult". Device on a table 3% vs worn 35% agreement.
- Lesson: child-vs-adult speaker logic is the weak point at ages 5-8. Do not rely on pitch to decide "this is the child".

**ReCANVo** ([Johnson, Narain, Quatieri, Maes, Picard, Sci Data 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10404278/); [Zenodo](https://zenodo.org/records/5786859)):
- 7,077 labeled vocalizations from 8 minimally speaking people (0-10 words), mostly aged 6-12 (two aged 18-25). Clips ~0.5-4 s, 16-bit 44.1 kHz WAV from a wearable Sony IDC-TX800, labeled live by caregivers.
- Labels: self-talk 1,885; frustrated 1,536; delighted 1,272; dysregulated 704; social 634; request 419; plus optional (yes, affectionate, laughter, etc.).
- Segmentation used -20 to -45 dB thresholds per session and 250-450 ms silence gaps. The paper reports no F0/duration stats and no baseline classifier.
- Related: [personalized SVM, 6 states, weighted F1 0.67](https://www.media.mit.edu/publications/augmenting-natural-communication-in-nonverbal-individuals-with-autism/); [transfer learning (ICML 2021 workshop)](https://icml.cc/virtual/2021/12732) helped only 2 of 8 individuals vs fully personalized nets, so **models must be per-child**; [naive raters can still judge arousal/valence](https://www.ll.mit.edu/r-d/publications/affective-ratings-nonverbal-vocalizations-produced-minimally-speaking-individuals). Tran & Tsai, IEEE Access v12, "Identification of Non-Speaking and Minimal-Speaking Individuals Using Nonverbal Vocalizations" **[details unverified]**. EU project [COMUTTI](https://cordis.europa.eu/project/id/101109600) targets caregiver-labeled classifiers.

**Oller protophone / canonical-babbling taxonomy.** Protophones are the non-cry, non-laugh precursors of speech (quasi-vowels, full vowels, squeals, growls, raspberries, whispers) plus canonical syllables, which have a consonant-like closure and a rapid formant transition ([Oller et al.](https://digitalcommons.memphis.edu/facpubs/15652)). Canonical babbling = well-formed CV syllables, often reduplicated; the usual transition-duration criterion (~120 ms) is from memory **[unverified]**. Automatic assessment: [AVA, JSLHR 2017](https://pubs.asha.org/doi/10.1044/2017_JSLHR-L-16-0157); [Warlaumont canonical-babble detection](https://www.isca-archive.org/interspeech_2016/warlaumont16_interspeech.pdf); [Long/Oller 2024 trajectories](https://www.waisman.wisc.edu/?p=32995). Almost all of this is infant-focused; little is tuned for ages 3-8.

**ML for child vocalization class (2023-2025):**
- [Li, Hasegawa-Johnson et al., wav2vec2-base + phonetic embeddings](https://ar5iv.labs.arxiv.org/html/2309.07287): clinician-child sessions, ages 1-2, classes VOC/VERB/CRY/LAU, child-VC F1 55.7 -> 58.4. BabbleCor (52 children, 2-36 mo; canonical / non-canonical / laugh / cry / junk): best UAR **64.6%** (prior 62.4%). Even SOTA is mid-60s, and a 12-layer 768-d model (~95M params, my estimate) is heavy for on-device use.
- [Child-specific VAD for autism](https://public-pages-files-2025.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2022.837269/text) (LSTM, 130 features, 17 h): ROC-AUC **0.66** vs 0.85 for a general VAD trained alike. Vocal-activity detection for autistic children is genuinely harder.
- I found no 2023-2026 paper reporting canonical vs non-canonical classification specifically for minimally verbal 3-8 year olds.

## 2. Acoustic properties

- No dataset I found publishes absolute F0 / duration for 3-8 yo minimally verbal speech. Treat the numbers below as priors to calibrate per child.
- Typical child F0 is roughly 250-400 Hz at ages 3-8 (general phonetics, **[unverified here]**); adult male ~100-120 Hz, female ~200 Hz.
- Autism findings are mixed. In 66 preschoolers (~40 mo), higher mean F0 of speech-like vocalizations and fewer phonemes per vocalization tracked ADOS severity (>25% of RRB variance) ([Moffitt 2022](https://idsc.miami.edu/objective-measurement-of-vocalizations-in-the-assessment-of-autism-spectrum-disorder-symptoms-in-preschool-age-children/)). Autistic toddler cries: higher mean F0 and F0 SD, lower peak frequency ([INSAR 2019](https://insar.confex.com/insar/2019/webprogram/Paper32239.html)). A 5-vs-5 preschool study found lower mean F0 but higher F0 SD in ASD ([LSU thesis](https://repository.lsu.edu/gradschool_theses/4914)). Net: **wide, erratic F0 range; pitch-based gating is unsafe**. Trackers also make octave (half/double) errors.
- ReCANVo clips are 0.5-4 s; LENA discards <0.6 s, so **short bursts are lost by design** in LENA.
- Syllable shapes: mostly vowels, quasi-vowels, hums, single CV, rarely reduplicated; fewer phonemes per utterance. Includes self-talk, squeals, vocalized dysregulation, and long prosodic contours without articulatory closure.
- Why VAD/ASR fail: models learn "speech = harmonic + formant + word-like envelope"; these sounds are breathy, nasal, creaky, squealed, or voiced-with-noise, and brief. TV, siblings and caregivers dominate the background. ASR forces words onto them (hallucination) and has no "not a word" class.

## 3. What "closer" means clinically

- **Shaping / approximation hierarchy** (SLP/ABA practice): any vocalization -> specific vowel -> consonant + vowel (CV) -> reduplicated CVCV ("nuh-nuh") -> varied CVCV -> target word. Example: "Buh" -> "Buh-ll" -> "Bubbles" ([ABA program](https://www.iloveaba.com/2011/12/program-vocal-imitation.html)). Shaping taught vocal skills faster than rewarding any "reasonable attempt" in three preschoolers ([Newman et al., PMC2779071](https://pmc.ncbi.nlm.nih.gov/articles/PMC2779071)). Tiny n; practitioner sources dominate.
- **Kaufman K-SLP**: "progressive approximation" over syllable shapes from V and CV up to CCVCVC, moving single syllables -> words -> phrases; e.g. banana -> "nuh" -> "nuh-nuh" -> "na-nuh" ([AJSLP 2024](https://pubs.asha.org/doi/10.1044/2024_AJSLP-24-00098); evidence called suggestive, and the target population is apraxia, not autism per se). I could not retrieve the manual's exact level list.
- **How closeness is judged** (clinical practice, general knowledge): syllable count, syllable shape, vowel match, first-consonant place/manner/voicing, then stress/prosody. Exact-phoneme matching is not the criterion early on.
- **Automated approaches**:
  - Phoneme-level edit distance on recognized phones vs the target (needs a child phone recognizer).
  - GOP: [Getman et al., SLaTE 2023, multi-task wav2vec2 for child pronunciation scoring](https://www.isca-archive.org/slate_2023/getman23_slate.pdf); [Wills et al., wav2vec2/Whisper phone feedback for children](https://arxiv.org/abs/2306.16710v1). A fine-tuned wav2vec2 phone detector only slightly beat a GOP baseline in a [Utrecht thesis](https://studenttheses.uu.nl/handle/20.500.12932/46548).
  - [Kid-Whisper](https://arxiv.org/abs/2309.07927v3): MyST WER Whisper-Small 13.93 -> 9.11%, Medium 13.23 -> 8.61%; code at [whisperKids](https://github.com/ahmedadelattia/whisperKids). [On-device tiny.en (39M) on MyST: 15.9% WER, 11.8% filtered](https://arxiv.org/pdf/2507.14451); thermal throttling seen on a Raspberry Pi.
  - These numbers are for typically developing, fluent children (MyST, CSLU Kids, CMU Kids). They say nothing about 0-10-word speakers.

## 4. Ethics, consent and privacy

- Children who cannot consent: parent/guardian consent plus assent where possible. For nonspeaking children assent has to be behavioral (willingness, withdrawal signals); parents should keep control, including pause and delete ([review](https://arxiv.org/pdf/2509.18235)). I found no source addressing nonspeaking assent directly.
- US COPPA treats an audio file with a child's voice as personal information once collected. The FTC's [2017 policy statement](https://ftc.gov/system/files/documents/public_statements/1266473/coppa_policy_statement_audiorecordings.pdf) relaxes this only for voice used as a replacement for typed words and "immediately destroyed", and does not cover research. Re-check current text, including 2025 amendments **[unverified]**.
- Published tools: LENA uploads day-long audio for cloud analysis ([source](https://pmc.ncbi.nlm.nih.gov/articles/PMC7855224)) **[verify against LENA's privacy policy]**. Canvas Dx (Cognoa) uses caregiver-recorded home video reviewed by analysts, with HIPAA-grade encryption claims ([FDA K243558 listing](https://510k.innolitics.com/device/K243558)). I found no retention/deletion terms, and nothing on EarlyBird. These are cloud, clinician-facing diagnostics, not a model for a child-facing game.

## Implications for an on-device engine

1. Define reward as "any sound-like event by the child above a per-child noise floor", never "recognized word". ASR must not gate reward.
2. Avoid pitch/speaker gating (LENA's child-vs-adult confusion is ~37% at ages 5-8). Assume a quiet room with the device near the child, and offer a "grown-ups quiet" cue.
3. Use energy + spectral-flux onset detection with an adaptive noise floor; accept events down to ~150-250 ms (below LENA's 0.6 s cutoff) and merge gaps under ~300 ms (ReCANVo used 250-450 ms).
4. Calibrate per child with a short parent-led session (noise floor, energy range, typical F0 band). Evidence says cross-child transfer is poor.
5. Treat closeness as a coarse feature vector, not a correctness score: duration, syllable count (envelope peaks), voicing ratio, vowel-like vs closure (CV) segmentation, rough vowel class. Map to the ladder any sound -> vowel -> CV -> CVCV -> target word.
6. Compare to the target by syllable count first, then vowel, then first-consonant class; use lenient tolerance and never show "wrong" - only same-or-higher feedback.
7. Keep any ML small: a ~1-10M-parameter CNN/GRU on log-mel, not wav2vec2-base. If a phone recognizer is used, a quantized child-tuned tiny model; Whisper-tiny (39M) at ~12-16% WER on typical kids is a ceiling, not a floor.
8. Never display or store ASR text for these sounds; hallucinated words undermine trust.
9. Privacy: process audio in a rolling in-memory buffer, persist only derived features (duration, syllable count, class), discard raw audio immediately. Raw clip saving off by default, opt-in per clip with delete.
10. Optional personalization: let a parent label a few sounds ("that was 'ba'") to build local per-child prototypes; log hit/false-reward rates locally to tune thresholds.
11. Validate on ReCANVo (check access terms) for event-detection recall, and measure false-reward rate under TV/sibling noise. No published accuracy exists for this exact task, so expect to measure it yourself.
