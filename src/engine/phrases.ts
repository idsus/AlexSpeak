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

export function promptText(
  name: string,
  word: string,
  targetSound = word,
  shapingLevel: ShapingLevel = 'word',
): string {
  if (shapingLevel === 'anySound') return `${name}, your turn. Any little sound.`
  if (shapingLevel === 'imitateSound') return `${name}, listen. ${targetSound}. Your turn.`
  if (shapingLevel === 'approximation') return `${name}, try ${targetSound} for ${word}.`
  return `${name}, can you say ${word}?`
}

// Slow, warm re-model of the word — deliberately not a question, just the
// word offered twice with a pause.
export function modelText(
  word: string,
  repromptCount = 0,
  targetSound = word,
  shapingLevel: ShapingLevel = 'word',
): string {
  const cap = word.charAt(0).toUpperCase() + word.slice(1)
  const sound = targetSound.charAt(0).toUpperCase() + targetSound.slice(1)

  if (shapingLevel === 'anySound') {
    if (repromptCount >= 1) return 'Any sound is enough. Ah. Mmm. Uh.'
    return 'My turn. Ah. ... Your turn.'
  }

  if (shapingLevel === 'imitateSound') {
    if (repromptCount >= 2) return `One tiny ${targetSound} is enough. ${sound}.`
    if (repromptCount === 1) return `Try a little ${targetSound}. ${sound}.`
    return `${sound}. ... ${sound}.`
  }

  if (shapingLevel === 'approximation') {
    if (repromptCount >= 2) return `Close is great. ${sound}.`
    if (repromptCount === 1) return `Try the first sound. ${sound}.`
    return `${sound}. ... ${cap}.`
  }

  if (repromptCount >= 2) return `One tiny sound is enough. ${cap}.`
  if (repromptCount === 1) return `Try any little sound. ${cap}.`
  return `${cap}. ... ${cap}.`
}

export function listenCoachText(
  name: string,
  word: string,
  targetSound = word,
  shapingLevel: ShapingLevel = 'word',
): string {
  if (shapingLevel === 'word') {
    return `${name}, say ${word}. ${word}.`
  }

  if (shapingLevel === 'approximation') {
    return `${name}, say ${targetSound}. ${targetSound}.`
  }

  if (shapingLevel === 'imitateSound') {
    return `${name}, say ${targetSound}. ${targetSound}. Your turn.`
  }

  return `${name}, try a sound. ${targetSound}. ${targetSound}.`
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
