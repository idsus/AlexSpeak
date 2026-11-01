import type { ReactNode } from 'react'
import './ui.css'

/** The target disc inside the listen ring. The ring breathes only while the app is listening. */
export function ListenDisc(props: { listening: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`listen ${props.listening ? 'listen--on' : ''} ${props.className ?? ''}`}>
      <div className="listen-ring" aria-hidden="true" />
      <div className="listen-disc">{props.children}</div>
    </div>
  )
}
