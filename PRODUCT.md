# Product

## Register

product

## Users

Two people share one tablet, sitting together:

- **The child**: minimally verbal or non-verbal, autistic, roughly 3–8 years old (the
  owner's brother). May not read. Sensory-sensitive: flashing, loud or sudden things are
  harmful, not exciting. Sees the screen as one big picture with one thing to do.
- **The parent/caregiver**: not a clinician, often tired, running a 3-minute burst between
  other things. Needs to know what to do *in the room* (hold the bubbles up, wait, give
  them) more than what to do on the screen. Occasionally shares progress with a
  speech-language pathologist.

Context: at home, on a tablet in landscape (phone portrait must work), offline.

## Product Purpose

AlexSpeak gives the pair short communication activities drawn from speech-therapy practice
(requesting with a real motivator, choosing, sound imitation, cause-and-effect
exclamations, song fill-ins, a starter talk board) plus attention games (memory match,
count the dots, find it) that each end in a speech moment. It rewards **any** attempt and
never scores right/wrong. Success is: the child learns that sounds and touches change the
world, the parent knows what to do next, and an SLP can read a one-page summary.

It must be as easy to start as a casual game: open, tap, playing. The tablet is a scaffold
for the interaction, not something the child plays alone.

## Brand Personality

Warm, bright, unhurried. Three words: **kind, clear, sturdy**. The voice is a calm adult
who is glad to see you ("Bubbles! Yes!"), never a cartoon, never a clinician. Pip, the
companion, is a soft blob with a face: it reacts, it never talks over the parent. Delight
is saved for the celebrate moment and the garden growing, and kept soft.

References: Duolingo ABC's one-big-thing-per-screen restraint; Finch's parent view that
reads like a sentence, not a chart; chunky flat-colour toddler toys (rounded, pressable).
The approved design canvas: https://claude.ai/artifact/9FymQdjmXTkJHXRpR6MpgA

## Anti-references

- Beige "calm clinical" palettes and jargon chips ("Voice calibrating", "Imitate the sound").
- Nick Jr / mobile-game loudness: confetti cannons, bouncing everything, sparkle loops,
  mascots that talk over the parent.
- Pass/fail UI: red X, buzzers, "try again" loops, streak pressure.
- AI-default visuals: purple gradients, glassmorphism, three equal feature cards, Inter + slate.
- Dashboards for parents: no charts that need a legend.

## Design Principles

1. **One thing on the screen.** The child's target is huge; everything else is small, grey,
   or behind a long-press.
2. **The real world is the reward.** The screen says "Give the bubbles now"; it never tries
   to be the bubbles.
3. **Any attempt counts, and it shows.** Feedback is immediate, warm, brief, never negative.
   There is no miss state.
4. **The parent always knows the next move.** One sentence of coaching per activity in the
   parent strip, in plain words.
5. **Predictable over surprising.** Same layout every time, fixed button positions, slow
   motion, no flashing, always an exit.

## Accessibility & Inclusion

- Sensory safety first: no flashing (never more than one luminance change per second on
  large areas), no sudden loud sound, motion ≤ 600 ms and easing out, everything
  motion-free under `prefers-reduced-motion` or the parent's Calm mode.
- WCAG 2.2 AA contrast for all parent text; child-facing words are huge, ink on warm white.
- Touch targets ≥ 88 px for the child, ≥ 44 px for the parent. Zoom never disabled.
- Works with no mic (parent "I saw it!" hold button) and no camera at all.
- Child-facing screens need no reading; every word is also spoken.
- All data on-device; nothing leaves the tablet.
