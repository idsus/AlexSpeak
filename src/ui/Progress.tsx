import { loadLog, summarize, exportJson } from '../data/sessionLog'

interface Props {
  onClose: () => void
}

const CHANNEL_LABELS: Record<string, string> = {
  audio: '🔊 sound',
  mouth: '👄 mouth',
  manual: '👀 caregiver',
}

export default function Progress({ onClose }: Props) {
  const summaries = summarize(loadLog()).sort((a, b) => b.startedAt - a.startedAt)

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alexspeak-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="screen">
      <div className="panel">
        <h2>Progress</h2>
        <p className="hint" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Everything is stored on this device only. Use export to share a summary with an SLP.
        </p>

        {summaries.length === 0 && <p>No sessions yet — they will show up here.</p>}

        {summaries.map((s) => (
          <div key={s.sessionId} className="session-card">
            <strong>{new Date(s.startedAt).toLocaleString()}</strong>
            <div>
              {s.successes} of {s.trials} words had an attempt
              {s.meanLatencyMs !== null &&
                ` · responded in ~${(s.meanLatencyMs / 1000).toFixed(1)} s`}
            </div>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
              {Object.entries(s.channels)
                .map(([ch, n]) => `${CHANNEL_LABELS[ch] ?? ch} ×${n}`)
                .join(' · ')}
            </div>
          </div>
        ))}

        <div className="field-row" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={download} disabled={summaries.length === 0}>
            ⬇️ Export for SLP
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
