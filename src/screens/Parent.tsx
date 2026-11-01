import { useState } from 'react'
import { displayName, saveSettings, type Settings } from '../data/settings'
import { loadLog } from '../data/log'
import { loadGarden } from '../data/garden'
import { Progress } from './Progress'
import { SetUp } from './SetUp'
import { Why } from './Why'
import './Parent.css'

type Tab = 'progress' | 'setup' | 'why'
const TABS: { id: Tab; label: string }[] = [
  { id: 'progress', label: 'Progress' },
  { id: 'setup', label: 'Set up' },
  { id: 'why', label: 'Why this works' },
]

export function Parent({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('progress')
  // Read once per visit: nothing is logged while the parent area is open.
  const [log] = useState(() => loadLog())
  const [garden] = useState(() => loadGarden())
  const change = (s: Settings) => {
    saveSettings(s)
    onChange(s)
  }
  const name = displayName(settings.childName)

  return (
    <div className="pa">
      <header className="pa-head">
        <div className="pa-tabs" role="tablist" aria-label="Parent area">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`pa-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="pa-panel"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="pa-close" aria-label={`Back to ${name}'s screen`} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <main id="pa-panel" role="tabpanel" aria-labelledby={`pa-tab-${tab}`} className="pa-panel">
        {tab === 'progress' && <Progress childName={settings.childName} log={log} garden={garden} />}
        {tab === 'setup' && <SetUp settings={settings} onChange={change} />}
        {tab === 'why' && <Why />}
      </main>

      {tab !== 'progress' && (
        <p className="pa-footer">
          AlexSpeak is a practice tool for home, not treatment. A speech-language pathologist should set the goals. Everything stays on this tablet.
        </p>
      )}
    </div>
  )
}
