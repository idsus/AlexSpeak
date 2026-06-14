// Hand-written phrase bank. Every line doubles as the clip id: the build-time
// tools/generate_clips.py renders one audio file per id, and playClip falls
// back to the Web Speech API with the same text when a clip is missing.

import type { ShapingLevel } from '../data/settings'

export interface Phrase {
  id: string
  text: string
}

export const PRAISE_LINES: Phrase[] = [
  { id: 'praise-01', text: 'I heard you! Wonderful!' },
  { id: 'praise-02', text: 'Yes! That was great!' },
  { id: 'praise-03', text: 'Beautiful try! I love it!' },
  { id: 'praise-04', text: 'You did it! Amazing!' },
  { id: 'praise-05', text: 'Wow, what a great sound!' },
  { id: 'praise-06', text: 'That made me so happy!' },
  { id: 'praise-07', text: 'Super! You are doing so well!' },
  { id: 'praise-08', text: 'I saw that! Fantastic!' },
  { id: 'praise-09', text: 'Yay! Great talking!' },
  { id: 'praise-10', text: 'You are awesome!' },
  { id: 'praise-11', text: 'What a wonderful try!' },
  { id: 'praise-12', text: 'I love hearing your voice!' },
  { id: 'praise-13', text: 'High five! That was great!' },
  { id: 'praise-14', text: 'So good! You did that all by yourself!' },
  { id: 'praise-15', text: 'Hooray! Lovely sound!' },
  { id: 'praise-16', text: 'That was brilliant!' },
  { id: 'praise-17', text: 'You are such a great talker!' },
  { id: 'praise-18', text: 'I am so proud of you!' },
  { id: 'praise-19', text: 'Yes yes yes! Wonderful!' },
  { id: 'praise-20', text: 'Great job! That was lovely!' },
]

// Played when re-prompts are exhausted — warm, zero pressure, never "you failed".
export const ENCOURAGE_LINES: Phrase[] = [
  { id: 'encourage-01', text: 'That is okay! I love spending time with you.' },
  { id: 'encourage-02', text: 'Great sitting with me! Let us look at another one.' },
  { id: 'encourage-03', text: 'You are doing great just being here.' },
  { id: 'encourage-04', text: 'No worries at all. Here comes a new one!' },
  { id: 'encourage-05', text: 'Thank you for listening so nicely!' },
]

export const SESSION_END_LINES: Phrase[] = [
  { id: 'end-01', text: 'All done! You did wonderful work today!' },
  { id: 'end-02', text: 'That was so much fun! See you next time!' },
]

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Stretch the last vowel so the model sounds drawn-out and human, the way you
// naturally over-pronounce for a child: "why" -> "whyyyyyyy", "ma" -> "maaaaaaa".
export function elongate(sound: string): string {
  const s = sound.trim()
  if (!s) return s
  const vowels = 'aeiouy'
  let idx = -1
  for (let i = s.length - 1; i >= 0; i -= 1) {
    if (vowels.includes(s[i].toLowerCase())) {
      idx = i
      break
    }
  }
  if (idx === -1) idx = s.length - 1
  return s.slice(0, idx) + s[idx].repeat(7) + s.slice(idx + 1)
}

// All three coach lines below are deliberately just the SOUND — no name, no
// "your turn", no "try a little". We model it enthusiastically: the plain sound,
// then the same sound stretched out, so he hears exactly what to imitate.
export function promptText(
  _name: string,
  word: string,
  targetSound = word,
  _shapingLevel: ShapingLevel = 'word',
): string {
  const sound = (targetSound || word).trim()
  return `${cap(sound)}! ${cap(elongate(sound))}!`
}

export function modelText(
  word: string,
  repromptCount = 0,
  targetSound = word,
  _shapingLevel: ShapingLevel = 'word',
): string {
  const sound = (targetSound || word).trim()
  // Re-prompts lean fully into the stretched, sing-song version.
  if (repromptCount >= 1) return `${cap(elongate(sound))}! ${cap(elongate(sound))}!`
  return `${cap(sound)}! ${cap(elongate(sound))}!`
}

export function listenCoachText(
  _name: string,
  word: string,
  targetSound = word,
  _shapingLevel: ShapingLevel = 'word',
): string {
  const sound = (targetSound || word).trim()
  return `${cap(elongate(sound))}!`
}

export function promptClipId(word: string): string {
  return `prompt-${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function modelClipId(word: string): string {
  return `model-${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function coachClipId(word: string): string {
  return `coach-${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

// Returns a picker that never hands out the same phrase twice in a row.
export function makePicker(
  lines: Phrase[],
  rng: () => number = Math.random,
): () => Phrase {
  let lastId: string | null = null
  return () => {
    let phrase = lines[Math.floor(rng() * lines.length)]
    if (phrase.id === lastId && lines.length > 1) {
      const index = lines.findIndex((l) => l.id === phrase.id)
      phrase = lines[(index + 1) % lines.length]
    }
    lastId = phrase.id
    return phrase
  }
}
