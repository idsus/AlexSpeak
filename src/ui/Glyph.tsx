import type { ReactElement } from 'react'
import type { CoreGlyphId, GlyphId } from '../data/content'

type Paint = { H: string; T: string }
type Art = { box: number; draw: (p: Paint) => ReactElement }

const INK = 'var(--ink)'
const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z'

// Simple flat pictures; motivators take the activity hue, animals keep their own colours.
const ART: Record<GlyphId | CoreGlyphId, Art> = {
  bubbles: { box: 240, draw: ({ H, T }) => (<>
    <circle cx="92" cy="130" r="64" fill={T} stroke={H} strokeWidth="6" />
    <circle cx="170" cy="76" r="40" fill={T} stroke={H} strokeWidth="6" />
    <circle cx="176" cy="160" r="24" fill={T} stroke={H} strokeWidth="6" />
    <circle cx="66" cy="104" r="12" fill="var(--surface)" /><circle cx="156" cy="60" r="8" fill="var(--surface)" />
  </>) },
  sock: { box: 240, draw: ({ H, T }) => (<>
    <path d="M86 40h64v80l34 44a36 36 0 0 1-50 50l-54-42z" fill={T} stroke={H} strokeWidth="6" strokeLinejoin="round" />
    <rect x="80" y="30" width="76" height="26" rx="8" fill={H} />
  </>) },
  // a bowl with three round pieces on top
  snack: { box: 24, draw: ({ H, T }) => (<>
    <circle cx="8" cy="10" r="3" fill={T} stroke={H} strokeWidth="1.8" />
    <circle cx="16" cy="10" r="3" fill={T} stroke={H} strokeWidth="1.8" />
    <circle cx="12" cy="8" r="3" fill={T} stroke={H} strokeWidth="1.8" />
    <path d="M2.5 12h19a9.5 8 0 0 1-19 0z" fill={H} />
  </>) },
  car: { box: 24, draw: ({ H }) => (<>
    <path d="M3 12l4-5h10l4 5v5H3z" fill={H} />
    <rect x="8" y="8.5" width="4" height="3" rx="1" fill="var(--surface)" />
    <circle cx="7.5" cy="17.5" r="2.5" fill={INK} /><circle cx="16.5" cy="17.5" r="2.5" fill={INK} />
  </>) },
  tickle: { box: 24, draw: ({ H }) => (
    <path d="M4 15a3 3 0 0 0 3 3h2l1-6a4 4 0 0 1 4-4V5a2 2 0 1 1 4 0v3a4 4 0 0 1 4 4l1 6h-2" stroke={H} strokeWidth="2.5" fill="none" strokeLinecap="round" />
  ) },
  swing: { box: 24, draw: ({ H }) => (<>
    <path d="M3 3h18M8 3v12M16 3v12" stroke={H} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <rect x="5.5" y="14.5" width="13" height="4" rx="2" fill={H} />
  </>) },
  music: { box: 24, draw: ({ H }) => (<>
    <circle cx="7.5" cy="18" r="3.2" fill={H} /><circle cx="17" cy="16" r="3.2" fill={H} />
    <path d="M10.7 18V6l9.5-2.5V16" stroke={H} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>) },
  ball: { box: 24, draw: ({ H, T }) => (<>
    <circle cx="12" cy="12" r="9" fill={T} stroke={H} strokeWidth="2" />
    <path d="M3 12h18M12 3c3 2.5 3 15.5 0 18M12 3c-3 2.5-3 15.5 0 18" stroke={H} strokeWidth="2" fill="none" />
  </>) },
  tablet: { box: 24, draw: ({ H, T }) => (<>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" fill={T} stroke={H} strokeWidth="2" />
    <circle cx="12" cy="18.5" r="1.2" fill={H} />
  </>) },
  spoon: { box: 24, draw: ({ H, T }) => (<>
    <ellipse cx="12" cy="7" rx="4" ry="5" fill={T} stroke={H} strokeWidth="2" />
    <path d="M12 12v9" stroke={H} strokeWidth="2.6" strokeLinecap="round" />
  </>) },
  box: { box: 24, draw: ({ H, T }) => (<>
    <rect x="4" y="9" width="16" height="11" rx="1.5" fill={T} stroke={H} strokeWidth="2" />
    <path d="M4 9l3-5h10l3 5M12 4v5" stroke={H} strokeWidth="2" fill="none" strokeLinejoin="round" />
  </>) },
  dog: { box: 64, draw: () => (<>
    <ellipse cx="32" cy="36" rx="20" ry="17" fill="#C98A5A" />
    <ellipse cx="14" cy="28" rx="7" ry="12" fill="#A86B3C" /><ellipse cx="50" cy="28" rx="7" ry="12" fill="#A86B3C" />
    <circle cx="25" cy="33" r="3" fill={INK} /><circle cx="39" cy="33" r="3" fill={INK} />
    <ellipse cx="32" cy="42" rx="5" ry="3.5" fill={INK} />
  </>) },
  cat: { box: 64, draw: () => (<>
    <path d="M14 30L12 10l14 10zM50 30l2-20-14 10z" fill="#D9893F" />
    <ellipse cx="32" cy="38" rx="21" ry="17" fill="#E9A35A" />
    <circle cx="24" cy="35" r="3" fill={INK} /><circle cx="40" cy="35" r="3" fill={INK} />
    <path d="M29 42h6l-3 3z" fill={INK} />
    <path d="M10 41h10M10 46l10-2M54 41H44M54 46l-10-2" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
  </>) },
  cup: { box: 24, draw: ({ H }) => (<>
    <path d="M5 6h11v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill={H} />
    <path d="M16 8h2a2.5 2.5 0 0 1 0 5h-2" stroke={H} strokeWidth="2" fill="none" />
  </>) },
  star: { box: 24, draw: () => <path d={STAR} fill="var(--star)" /> },
  // Talk board core words: ink line icons on the board yellow.
  more: { box: 24, draw: () => <path d="M12 5v14M5 12h14" stroke={INK} strokeWidth="3.5" strokeLinecap="round" /> },
  alldone: { box: 24, draw: () => <path d="M5 12l5 5 9-10" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> },
  help: { box: 24, draw: () => <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14l-1 9H6z" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /> },
  open: { box: 24, draw: () => (<>
    <rect x="4" y="9" width="16" height="11" rx="2" stroke={INK} strokeWidth="3" fill="none" />
    <path d="M4 9l8-5 8 5" stroke={INK} strokeWidth="3" fill="none" strokeLinejoin="round" />
  </>) },
  go: { box: 24, draw: () => <path d="M8 5v14l11-7z" fill={INK} /> },
  stop: { box: 24, draw: () => <path d="M8 4h8l4 4v8l-4 4H8l-4-4V8z" stroke={INK} strokeWidth="3" fill="none" strokeLinejoin="round" /> },
  up: { box: 24, draw: () => <path d="M12 19V6M6 12l6-6 6 6" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> },
  mine: { box: 24, draw: () => <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" stroke={INK} strokeWidth="3" fill="none" strokeLinejoin="round" /> },
}

/** hue: an activity hue id ('ask', 'choose'…) or any CSS colour. */
function paint(hue: string): Paint {
  if (/^(#|var\(|rgb)/.test(hue)) return { H: hue, T: 'var(--surface)' }
  return { H: `var(--hue-${hue})`, T: `var(--hue-${hue}-tint)` }
}

export function Glyph(props: { id: GlyphId | CoreGlyphId; hue: string; size?: number; photo?: string | null; label?: string }) {
  const { id, hue, size = 64, photo, label } = props
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  if (photo) {
    return <img src={photo} alt={label ?? ''} width={size} height={size} className="glyph-photo" draggable={false} />
  }
  const art = ART[id] ?? ART.star
  return (
    <svg width={size} height={size} viewBox={`0 0 ${art.box} ${art.box}`} {...a11y}>
      {art.draw(paint(hue))}
    </svg>
  )
}
