import { useMemo } from 'react'

interface Props {
  praiseText: string
  emoji: string
  reward: string
  imageUrl?: string
}

const STARS = ['⭐', '🌟', '✨', '💛', '🎈']

// Gentle celebration: slow rising stars and a softly bouncing emoji.
// Deliberately no flashing or rapid motion — sensory safety first.
export default function RewardScreen({ praiseText, emoji, reward, imageUrl }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: `${(i * 8.3 + 4) % 100}%`,
        delay: `${(i % 6) * 0.35}s`,
        char: STARS[i % STARS.length],
      })),
    [],
  )

  return (
    <div className="screen">
      <div className="star-field">
        {stars.map((s, i) => (
          <span key={i} className="star" style={{ left: s.left, animationDelay: s.delay }}>
            {s.char}
          </span>
        ))}
      </div>
      {imageUrl ? (
        <img className="reward-photo celebrate-emoji" src={imageUrl} alt="" />
      ) : (
        <div className="big-emoji celebrate-emoji">{emoji}</div>
      )}
      <div className="word">{praiseText}</div>
      {reward && <div className="reward-cue">Now: {reward}</div>}
    </div>
  )
}
