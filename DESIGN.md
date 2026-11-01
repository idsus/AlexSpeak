---
name: AlexSpeak
description: Bright, warm, chunky toddler-toy UI for a parent-and-child speech practice app
colors:
  bg: "#FFFDF7"
  surface: "#FFFFFF"
  surface-2: "#F6F1E6"
  ink: "#1F2933"
  ink-2: "#52606D"
  ink-3: "#7B8794"
  line: "#E4DCCB"
  pip: "#9FD8C3"
  ask: "#FF8A3D"
  ask-deep: "#D96A20"
  ask-tint: "#FFE7D3"
  choose: "#5B8DEF"
  choose-deep: "#3F6FD1"
  copy: "#7C5CE6"
  copy-deep: "#5F43C4"
  uhoh: "#F2555A"
  uhoh-deep: "#CC3A40"
  song: "#2BB673"
  song-deep: "#1E9159"
  board: "#F5B700"
  board-deep: "#CF9A00"
  star: "#FFC933"
  done-bg: "#EEF9F3"
typography:
  word:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "clamp(4rem, 14vw, 10rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  strip:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "14px"
  md: "24px"
  lg: "32px"
  xl: "40px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
components:
  button-chunky:
    backgroundColor: "{colors.ask}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "20px 32px"
    height: "88px"
  button-parent:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "48px"
  tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px 12px"
  parent-strip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.strip}"
    padding: "12px 20px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
---

# Design System: AlexSpeak

## 1. Overview

A chunky toddler-toy look on a warm white page: one huge thing per screen, one saturated
hue per activity as identity, rounded everything, and pressable buttons with a solid darker
bottom edge. Pip (a mint blob with two dot eyes and a mouth) is the one character. The
parent layer is small, grey and quiet. Motion is sparse, short and eases out; the only
generous animation is the celebrate moment, and even that is slow and soft. It should feel
like a well-made wooden toy, not a game and not a clinic. The source of truth for layout is
the approved canvas (https://claude.ai/artifact/9FymQdjmXTkJHXRpR6MpgA).

## 2. Colors: One Hue Per Activity

### Primary
Each activity owns one hue and its deep partner (button bottom edge and pressed state):
ask `#FF8A3D`/`#D96A20`, choose `#5B8DEF`/`#3F6FD1`, copy `#7C5CE6`/`#5F43C4`,
uh-oh `#F2555A`/`#CC3A40`, song `#2BB673`/`#1E9159`, board `#F5B700`/`#CF9A00`.
Play and All-done use the song green; Memory match uses choose blue; Count uses copy violet;
Find it uses song green. Inside an activity its hue is the only accent on screen.

### Secondary
Star yellow `#FFC933` for stars only. Pip mint `#9FD8C3` for Pip only. Celebrate tints the
page with the activity's tint (`ask-tint` `#FFE7D3` for ask; derive the others at the same
lightness).

### Neutral
Background `#FFFDF7`, card `#FFFFFF`, parent surfaces `#F6F1E6`, hairline `#E4DCCB`.
Ink `#1F2933` for the child's word and headings; `#52606D` for parent text; `#7B8794` only
for small caps labels and hints on white.

### Named Rules
- White text on hue only at ≥ 24 px bold; ink on board yellow at any size.
- **Deep edge**: chunky buttons have `box-shadow: 0 6px 0 <hue-deep>`; pressed removes the
  edge and translates down 4 px.
- No gradients, no glass. One float shadow `0 12px 32px rgba(31,41,51,0.14)` for the
  celebrate card, the mic dialog and the parent sheet.

## 3. Typography

One family: **Nunito** (variable, bundled from `@fontsource-variable/nunito`; no runtime
font network). Fixed rem scale for everything the parent reads; one fluid size for the
child's word.

### Hierarchy
- **word**: 900, `clamp(4rem, 14vw, 10rem)`, line-height 1, `-0.02em`. The child's target.
- **title**: 800, 2.5rem. "Hi Alex", "All done!", parent headings.
- **label**: 700, 1.25rem. Tile labels, chunky button text.
- **body**: 600, 1.0625rem. Parent prose, settings.
- **strip**: 600, 1.0625rem, ink-2. The coaching strip. Max 80ch.
- **small caps**: 700, 0.9375rem, `#7B8794`, `letter-spacing: 0.04em`, uppercase. Section labels.

### Named Rules
- Child-facing text is lowercase except names ("bubbles", "uh-oh!", "Hi Alex").
- Never a second family. Inputs ≥ 16 px so iOS never zooms.

## 4. Elevation

Flat by default.

### Shadow Vocabulary
- **edge**: `0 6px 0 <hue-deep>` on chunky buttons (identity, not depth).
- **ring**: `0 0 0 7px <hue>` marks the active/selected target (listen ring, face-up card).
- **float**: `0 12px 32px rgba(31,41,51,0.14)` on overlays only.

### Named Rules
- Cards sit on the page with a 1.5 px `#E4DCCB` border. Nothing else casts a shadow.

## 5. Components

### Buttons
- **Chunky (child)**: ≥ 88 px tall, radius 32, hue fill, white 700 label (or ink on
  yellow), deep edge. `:active` → `translateY(4px)`, edge removed, 100 ms ease-out.
  Feedback on `pointerdown`, `touch-action: manipulation`, no tap highlight,
  `user-select: none`.
- **Parent**: 48 px, pill, `#F6F1E6` fill or white with hairline, ink text.
- **Hold ("I saw it")**: parent pill with a 40 px conic ring that fills over 600 ms while
  held; fires on completion; release cancels. Bottom-right of every activity.
- **Focus**: 3 px `#1F2933` outline, 3 px offset, `:focus-visible` only.

### Chips
Pill, 44 px (36 px for the parent's ladder/song chips), white + hairline; selected = hue
fill + white text. Rung chips (looked · reached · sound · close · word) show for 3 s after
a celebrate, then fade 200 ms.

### Cards / Containers
- **Tile** (home): white, radius 28, hairline, 64 px hue SVG glyph, label under;
  `:active` scales 0.97.
- **Parent strip**: `#F6F1E6`, 12 × 20 px, ✕ (44 px white circle) at left, strip text
  ink-2, full width, `env(safe-area-inset-top)` padding. On celebrate it takes the
  activity tint and the text turns hue-deep and 700.
- **Target disc**: 360 px white circle with hairline, inside a 420 px **listen ring**
  (7 px hue, 85 % opacity) that breathes 0.96–1.0 scale / 0.6–1.0 opacity on a 4 s
  ease-in-out loop while waiting; static under reduced motion.
- **Celebrate card**: 400 px white disc with float shadow, the word in hue-deep, 6 soft
  stars drifting up 24 px and fading over 1.5 s (static under reduced motion).

### Pip (signature)
Inline SVG, viewBox 150×130: mint ellipse body, two ink dot eyes, a mouth path.
Four states by swapping eyes/mouth only: **listening** (smile), **surprised** (round
mouth), **thinking** (small o mouth), **delighted** (closed happy eyes, open smile, two
pink cheeks). Changes between states cross-fade 200 ms; never bounces.

### Inputs / Fields
Text inputs ≥ 16 px, radius 14, hairline, 52 px tall, `#FFFDF7` fill. Segmented 3-chip
groups instead of sliders. Switches 56 × 34.

### Navigation
No nav bar. Home ↔ activity ↔ parent sheet. ✕ top-left exits an activity; the parent
corner (bottom-right lock, 44 px) opens only on a 1.5 s long-press. Parent area is three
pill tabs: Progress · Set up · Why this works.

## 6. Do's and Don'ts

### Do:
- Keep one target per screen and let it be enormous.
- Use the activity's hue and nothing else as accent inside that activity.
- Ease out (`cubic-bezier(0.23, 1, 0.32, 1)`) for everything entering; 100–160 ms for
  press, 200–300 ms for overlays, 1.5 s max for the celebrate drift.
- Animate only `transform` and `opacity`; start entries at `scale(0.96) + opacity 0`.
- Wrap every `:hover` in `@media (hover: hover) and (pointer: fine)`.
- Use `100dvh`, `overscroll-behavior: none`, `viewport-fit=cover`, safe-area insets.

### Don't:
- Flash, strobe, shake, bounce (no spring bounce above 0.2), or loop decorative motion.
- Show the child jargon, status chips, percentages or clinician labels.
- Put parent controls over the child's target, or make a parent control a plain tap.
- Use `ease-in`, `transition: all`, `scale(0)`, or disable zoom.
- Add a second typeface, emoji as UI icons, gradients, glass, or a modal where an inline
  state will do.
