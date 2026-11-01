import './ui.css'

export type PipMood = 'listening' | 'surprised' | 'thinking' | 'delighted'

const LABEL: Record<PipMood, string> = {
  listening: 'Pip is listening',
  surprised: 'Pip is surprised',
  thinking: 'Pip is thinking',
  delighted: 'Pip is delighted',
}

const INK = 'var(--ink)'

/** The companion. Faces are layered and cross-fade on opacity; Pip never bounces. */
export function Pip(props: { mood: PipMood; size?: number; className?: string; waves?: boolean }) {
  const { mood, size = 150, className, waves = false } = props
  const on = (m: PipMood) => ({ className: 'pip-face', style: { opacity: mood === m ? 1 : 0 } })
  return (
    <svg width={size} height={(size * 130) / 150} viewBox="0 0 150 130" role="img" aria-label={LABEL[mood]} className={className} overflow="visible">
      <ellipse cx="75" cy="80" rx="58" ry="46" fill="var(--pip)" />
      <g {...on('listening')}>
        <circle cx="56" cy="74" r="6" fill={INK} /><circle cx="94" cy="74" r="6" fill={INK} />
        <path d="M60 94 Q75 104 90 94" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <g {...on('surprised')}>
        <circle cx="56" cy="72" r="7" fill={INK} /><circle cx="94" cy="72" r="7" fill={INK} />
        <ellipse cx="75" cy="100" rx="9" ry="11" fill={INK} />
      </g>
      <g {...on('thinking')}>
        <circle cx="56" cy="74" r="6" fill={INK} /><circle cx="94" cy="74" r="6" fill={INK} />
        <ellipse cx="75" cy="98" rx="10" ry="8" fill={INK} />
      </g>
      <g {...on('delighted')}>
        <path d="M48 70 q8 -10 16 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M86 70 q8 -10 16 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M55 92 Q75 112 95 92" stroke={INK} strokeWidth="5" fill="var(--surface)" strokeLinecap="round" />
        <circle cx="40" cy="92" r="6" fill="var(--pip-cheek)" opacity="0.8" />
        <circle cx="110" cy="92" r="6" fill="var(--pip-cheek)" opacity="0.8" />
      </g>
      <g className="pip-face" style={{ opacity: waves && mood === 'listening' ? 1 : 0 }} aria-hidden="true">
        <path d="M118 44 q10 -8 20 0" stroke="var(--h, var(--hue-ask))" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M124 30 q16 -12 32 0" stroke="var(--h, var(--hue-ask))" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.45" />
      </g>
    </svg>
  )
}
