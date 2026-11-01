import { useRef, useState } from 'react'
import type { Target } from '../data/content'
import type { ActivityProps } from './index'
import './scenes.css'

type Scene = 'tower' | 'bubbles' | 'car'
const SCENES: Scene[] = ['tower', 'bubbles', 'car']
const UH_OH: Target = { id: 'uh-oh', shown: 'uh-oh!', spoken: 'uh oh' }
const TAP_LABEL: Record<Scene, string> = { tower: 'tap to add a block', bubbles: 'tap to blow a bubble', car: 'tap to make the car go' }
const HINT: Record<Scene, string> = { tower: '5 taps, then it falls', bubbles: 'tap to blow, tap to pop', car: 'tap to go' }
const BLOCKS = 5
const DRIVE_MS = 600
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// standing tower, bottom block first; FALL is where each lands when it tumbles
const TOWER = [
  { x: 120, y: 380, w: 180 }, { x: 128, y: 290, w: 164 }, { x: 136, y: 200, w: 148 },
  { x: 144, y: 110, w: 132 }, { x: 152, y: 20, w: 116 },
]
const FALL = [
  'none', 'translate(-60px, 12px) rotate(-10deg)', 'translate(70px, 24px) rotate(12deg)',
  'translate(-100px, 200px) rotate(-25deg)', 'translate(120px, 300px) rotate(35deg)',
]

/** Three tiny cause-and-effect scenes; each ends in a surprise and an "uh-oh!". */
export function UhOh({ api, onDone }: ActivityProps) {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [step, setStep] = useState(0)
  const [event, setEvent] = useState(false) // fell / popped / crashed
  const busy = useRef(false)
  const scene = SCENES[sceneIdx]

  async function surprise() {
    busy.current = true
    setEvent(true)
    await api.runTrial(UH_OH)
    setSceneIdx((i) => (i + 1) % SCENES.length)
    setStep(0)
    setEvent(false)
    busy.current = false
    onDone()
  }

  async function tap() {
    if (busy.current) return
    if (scene === 'tower') {
      const n = step + 1
      setStep(n)
      if (n < BLOCKS) void api.say('up')
      else void surprise()
    } else if (scene === 'bubbles') {
      if (step === 0) { setStep(1); void api.say('blow') }
      else { void api.say('pop'); void surprise() }
    } else {
      busy.current = true
      setStep(1)
      void api.say('vroom')
      await wait(DRIVE_MS) // let the car reach the wall
      void surprise()
    }
  }

  const ring = api.listening

  return (
    <div className="sc hue-uhoh">
      <button type="button" className="uhoh-card" aria-label={TAP_LABEL[scene]} onClick={tap}>
        <svg width="420" height="520" viewBox="0 0 420 520" aria-hidden="true">
          {scene === 'tower' && (<>
            <rect x="40" y="470" width="340" height="14" rx="7" fill="var(--line)" />
            {TOWER.map((b, i) => (
              <rect
                key={i}
                x={b.x} y={b.y} width={b.w} height="84" rx="16" fill="var(--h)"
                className={i < step ? 'uhoh-part' : 'uhoh-part uhoh-part--hidden'}
                style={event ? { transform: FALL[i] } : undefined}
              />
            ))}
            <g className={event ? 'uhoh-burst uhoh-burst--on' : 'uhoh-burst'}>
              <path d="M330 300 q14 -8 20 6" stroke="var(--h-deep)" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M344 276 q20 -10 28 10" stroke="var(--h-deep)" strokeWidth="5" fill="none" strokeLinecap="round" />
            </g>
          </>)}

          {scene === 'bubbles' && (<>
            <circle cx="104" cy="404" r="34" fill="none" stroke="var(--h)" strokeWidth="10" />
            <path d="M80 428 L40 488" stroke="var(--h-deep)" strokeWidth="12" strokeLinecap="round" />
            <g className={step === 0 ? 'uhoh-part uhoh-bubble--hidden' : event ? 'uhoh-part uhoh-bubble--popped' : 'uhoh-part'}>
              <circle cx="240" cy="200" r="100" fill="var(--h-tint)" stroke="var(--h)" strokeWidth="6" />
              <path d="M190 150 a60 60 0 0 1 40 -26" stroke="#FFFFFF" strokeWidth="12" fill="none" strokeLinecap="round" />
            </g>
            <g className={event ? 'uhoh-burst uhoh-burst--on' : 'uhoh-burst'} stroke="var(--h-deep)" strokeWidth="6" strokeLinecap="round">
              <path d="M240 70 v30" /><path d="M240 300 v30" /><path d="M110 200 h30" /><path d="M340 200 h30" />
              <path d="M150 110 l20 20" /><path d="M330 110 l-20 20" /><path d="M150 290 l20 -20" /><path d="M330 290 l-20 -20" />
            </g>
          </>)}

          {scene === 'car' && (<>
            <rect x="20" y="408" width="380" height="12" rx="6" fill="var(--line)" />
            <g>
              <rect x="352" y="250" width="44" height="158" rx="6" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="3" />
              <path d="M352 290h44M352 330h44M352 370h44M374 250v40M374 330v40" stroke="var(--line)" strokeWidth="3" />
            </g>
            <g className={event ? 'uhoh-part uhoh-car--crash' : step === 1 ? 'uhoh-part uhoh-car--go' : 'uhoh-part'}>
              <rect x="30" y="330" width="150" height="56" rx="18" fill="var(--h)" />
              <rect x="60" y="302" width="90" height="44" rx="14" fill="var(--h)" />
              <rect x="74" y="310" width="30" height="26" rx="6" fill="#FFFFFF" />
              <circle cx="66" cy="390" r="18" fill="var(--ink)" /><circle cx="146" cy="390" r="18" fill="var(--ink)" />
              <circle cx="66" cy="390" r="7" fill="#FFFFFF" /><circle cx="146" cy="390" r="7" fill="#FFFFFF" />
            </g>
            <g className={event ? 'uhoh-burst uhoh-burst--on' : 'uhoh-burst'} stroke="var(--h-deep)" strokeWidth="5" fill="none" strokeLinecap="round">
              <path d="M330 280 q-14 -10 -24 2" /><path d="M326 250 q-22 -14 -36 4" />
            </g>
          </>)}
        </svg>
      </button>

      <div className="uhoh-side">
        <p className={event ? 'sc-word uhoh-word uhoh-word--on' : 'sc-word uhoh-word'}>{UH_OH.shown}</p>
        <div className={ring ? 'uhoh-bar uhoh-bar--on' : 'uhoh-bar'} aria-hidden="true" />
        <p className="sc-hint">{HINT[scene]}</p>
      </div>
    </div>
  )
}
