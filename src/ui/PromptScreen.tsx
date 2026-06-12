import type { Phase } from '../engine/stateMachine'
import type { WordEntry } from '../data/settings'

interface Props {
  entry: WordEntry
  phase: Phase
}

// The main in-session view for prompt / listen / model phases: the word, its
// picture, and a calm breathing ring while we listen.
export default function PromptScreen({ entry, phase }: Props) {
  return (
    <div className="screen">
      <div className="big-emoji">{entry.emoji}</div>
      <div className="word">{entry.word}</div>
      {phase === 'listen' && (
        <div className="listening-ring" aria-label="listening">
          👂
        </div>
      )}
      {phase === 'model' && <div className="subtitle">Listen…</div>}
    </div>
  )
}
