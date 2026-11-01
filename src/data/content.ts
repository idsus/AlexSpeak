// Everything the activities say and show. Child-facing words are lowercase.

export type ActivityId = 'ask' | 'choose' | 'copy' | 'uhoh' | 'song' | 'board' | 'memory' | 'count' | 'find'
export type HueId = 'ask' | 'choose' | 'copy' | 'uhoh' | 'song' | 'board'

/** spoken = the TTS-safe form ("mah" for "ma"). */
export interface Target { id: string; shown: string; spoken: string }

export type GlyphId =
  | 'bubbles' | 'snack' | 'car' | 'tickle' | 'swing' | 'music' | 'ball' | 'tablet'
  | 'sock' | 'spoon' | 'box' | 'dog' | 'cup' | 'cat' | 'star'
export type CoreGlyphId = 'more' | 'alldone' | 'help' | 'open' | 'go' | 'stop' | 'up' | 'mine'

/** glyph = key into the SVG glyph set (ui/Glyph.tsx). */
export interface Motivator extends Target { glyph: GlyphId }

const m = (id: GlyphId, shown: string = id, spoken: string = shown): Motivator => ({ id, shown, spoken, glyph: id })
const t = (shown: string, spoken: string = shown): Target => ({ id: shown, shown, spoken })

export const DEFAULT_MOTIVATORS: Motivator[] = [
  m('bubbles'), m('snack'), m('car'), m('tickle'), m('swing'), m('music'), m('ball'), m('tablet'),
]

export const NEUTRAL_ITEMS: Motivator[] = [m('sock'), m('spoon'), m('box')]

export const CORE_WORDS: (Target & { glyph: GlyphId | CoreGlyphId })[] = [
  { id: 'more', shown: 'more', spoken: 'more', glyph: 'more' },
  { id: 'all-done', shown: 'all done', spoken: 'all done', glyph: 'alldone' },
  { id: 'help', shown: 'help', spoken: 'help', glyph: 'help' },
  { id: 'open', shown: 'open', spoken: 'open', glyph: 'open' },
  { id: 'go', shown: 'go', spoken: 'go', glyph: 'go' },
  { id: 'stop', shown: 'stop', spoken: 'stop', glyph: 'stop' },
  { id: 'up', shown: 'up', spoken: 'up', glyph: 'up' },
  { id: 'mine', shown: 'mine', spoken: 'mine', glyph: 'mine' },
]

export const COPY_LADDER: { rung: number; label: string; targets: Target[] }[] = [
  { rung: 0, label: 'open sounds', targets: [t('ah', 'ahh'), t('oh', 'ohh'), t('ee', 'eee'), t('oo', 'ooo')] },
  { rung: 1, label: 'first sounds', targets: [t('ma', 'mah'), t('ba', 'bah'), t('da', 'dah'), t('pa', 'pah'), t('no'), t('go')] },
  { rung: 2, label: 'double sounds', targets: [t('mama', 'mama'), t('baba', 'bah bah'), t('dada', 'dada'), t('bye-bye', 'bye bye'), t('no-no', 'no no')] },
  { rung: 3, label: 'short words', targets: [t('up'), t('on'), t('off'), t('out'), t('eat')] },
  { rung: 4, label: 'core words', targets: [t('more'), t('mine'), t('stop'), t('help'), t('open')] },
]

export const SONGS: { id: string; title: string; lead: string; blank: Target }[] = [
  { id: 'ready-set-go', title: 'ready, set, go', lead: 'ready, set,', blank: t('go', 'go!') },
  { id: 'row-boat', title: 'row your boat', lead: 'row, row, row your', blank: t('boat') },
  { id: 'twinkle', title: 'twinkle', lead: 'twinkle, twinkle, little', blank: t('star') },
  { id: 'peekaboo', title: 'peek-a-boo', lead: 'peek-a-', blank: t('boo') },
  { id: 'count', title: 'one, two, three', lead: 'one, two,', blank: t('three') },
]

export const FIND_ITEMS: Motivator[] = [m('dog'), m('car'), m('cup'), m('ball'), m('cat'), m('star')]

/**
 * tip / celebrateTip are the parent strip sentences. Tokens: {name} child's name,
 * {thing} the real object, {word} the word on screen. sample fills {thing}/{word}
 * before the first trial. Fill with fillTip().
 */
export const ACTIVITIES: {
  id: ActivityId
  label: string
  hue: HueId
  tip: string
  celebrateTip: string
  sample: string
  why: string
}[] = [
  {
    id: 'ask', label: 'Ask for it', hue: 'ask', sample: 'bubbles',
    tip: 'Hold the {thing} up where {name} can see them. Wait 5 seconds. Any sound or reach = give the {thing}.',
    celebrateTip: 'Give the {thing} now. Say "{word}!" once more while you hand them over.',
    why: 'Asking for something you really want is the first reason to talk. When any sound or reach gets the real thing, your child learns that communicating works. This is the core of request training used by speech therapists.',
  },
  {
    id: 'choose', label: 'Choose', hue: 'choose', sample: 'bubbles',
    tip: 'Hold both real things up. Give {name} whichever one he touches, right away. A touch is talking.',
    celebrateTip: 'Give the {thing} now. Name it as you hand it over.',
    why: 'Making a choice is a powerful way to communicate without words. Touching a picture counts, and getting the chosen thing right away shows that choices matter. Over time the touch can be joined by a sound or a word.',
  },
  {
    id: 'copy', label: 'Copy me', hue: 'copy', sample: 'ba',
    tip: 'Get face to face. Copy any sound {name} makes first. Then say "{word}" once, big mouth, and wait.',
    celebrateTip: 'Say "{word}" back with a big smile. Copy whatever sound came out.',
    why: 'Copying sounds builds the mouth movements that words are made of. Copying the child first makes it a game of turns, not a test. The sounds go from easy open sounds up to short words, at your pace.',
  },
  {
    id: 'uhoh', label: 'Uh-oh!', hue: 'uhoh', sample: 'uh-oh',
    tip: '{name} taps to stack. When the tower falls, make a big "uh-oh!" face and wait for any sound.',
    celebrateTip: 'Say "uh-oh!" together with a big face. Then build it again.',
    why: 'Fun surprises make children want to say something. Short exclamations like "uh-oh" and "pop" are among the easiest first words. The same small scene every time makes the moment easy to predict.',
  },
  {
    id: 'song', label: 'Song', hue: 'song', sample: 'go',
    tip: 'Say it with the app, in your own voice, and stop at the same spot every time. The pause is the cue. Any sound = {word}!',
    celebrateTip: 'Finish the line together: "{word}!" Then sing it again.',
    why: 'Familiar songs and routines set up a word the child can predict. Pausing just before the last word invites your child to fill it in. Any sound in the gap counts as joining in.',
  },
  {
    id: 'board', label: 'Talk board', hue: 'board', sample: 'more',
    tip: 'When {name} touches a word, do it. Model by touching a word yourself as you say it. The buttons never move.',
    celebrateTip: 'Do what the word says, right away.',
    why: 'A talk board gives your child words to use right now, while speech grows. Touching a word and seeing you respond teaches that words make things happen. Using a board supports speech; it does not replace it.',
  },
  {
    id: 'memory', label: 'Memory match', hue: 'choose', sample: 'dog',
    tip: 'Take turns flipping. When two match, name it big — "{word}!" — and wait for {name} to try. Six cards only; never more.',
    celebrateTip: 'Say "{word}!" again and point to the pair.',
    why: 'Taking turns with cards practises waiting, looking and sharing attention. Each match ends with a word to try, so the game always leads back to talking. Six cards keeps it short and calm.',
  },
  {
    id: 'count', label: 'Count the dots', hue: 'copy', sample: 'three',
    tip: '{name} taps each dot; the app counts with him. On the last one it stops — "one, two, ___" — and waits. Any sound = "{word}!"',
    celebrateTip: 'Say "{word}!" together and count the dots once more.',
    why: 'Counting is a routine children know by heart, which makes the last number easy to predict. Stopping just before it invites your child to fill the gap. Tapping each dot keeps hands and attention together.',
  },
  {
    id: 'find', label: 'Find it', hue: 'song', sample: 'dog',
    tip: 'The app says "touch the {word}". Any touch is fine — the one he picks gets named big. No wrong answers, only words.',
    celebrateTip: 'Name it again: "{word}!" Point to a real one if you have it.',
    why: 'Hearing a word and touching a picture builds understanding of words. Whatever your child touches is named and celebrated, so there is nothing to get wrong. Understanding words comes before saying them.',
  },
]

export const MIXED_POOL: ActivityId[] = ['uhoh', 'copy', 'ask', 'choose', 'song', 'memory', 'count']

export function activityInfo(id: ActivityId) {
  return ACTIVITIES.find((a) => a.id === id)!
}

export function fillTip(text: string, vars: { name: string; thing: string; word: string }): string {
  return text.replace(/\{(name|thing|word)\}/g, (_, k: 'name' | 'thing' | 'word') => vars[k])
}

/** level 0 'bubbles' · 1 'more bubbles' · 2 'want bubbles'. id stays the motivator's id. */
export function wordForm(mot: Motivator, level: 0 | 1 | 2): Target {
  const prefix = ['', 'more ', 'want '][level]
  return { id: mot.id, shown: prefix + mot.shown, spoken: prefix + mot.spoken }
}
