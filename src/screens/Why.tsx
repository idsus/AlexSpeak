import { ACTIVITIES } from '../data/content'

export function Why() {
  return (
    <ul className="pa-why">
      {ACTIVITIES.map((a) => (
        <li key={a.id} className="pa-card">
          <h2 className="pa-setting-name">
            <i className="pa-dot" style={{ background: `var(--hue-${a.hue})` }} aria-hidden="true" />
            {a.label}
          </h2>
          <p className="pa-body">{a.why}</p>
        </li>
      ))}
    </ul>
  )
}
