import { useEffect, useState } from 'react'
import type { Settings } from '../data/settings'
import { correctedThreshold, loadHeard, markHeard, type Fired, type Heard, type Said } from '../data/heard'
import { clipStats, deleteAllClips, getClip } from '../data/clipStore'
import { RecordWord } from './Recorder'

const FIRED: Record<Fired, string> = { voice: 'voice', energy: 'loud sound', parent: 'filtered as your voice' }
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`

/** The last few sounds the mic caught, with one-tap corrections that tune the parent filter. */
export function HeardCard({ settings, name, set }: { settings: Settings; name: string; set: (patch: Partial<Settings>) => void }) {
  const [heard, setHeard] = useState<Heard[]>(() => loadHeard())
  const [stats, setStats] = useState({ count: 0, bytes: 0 })
  const refreshStats = () => void clipStats().then(setStats, () => {})
  useEffect(refreshStats, [])

  const say = (h: Heard, said: Said) => {
    set({ parentThreshold: correctedThreshold(settings.parentThreshold, h, said) })
    setHeard(markHeard(h.id, said))
  }

  const play = async (id: number) => {
    const wav = await getClip(id)
    if (!wav) return
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    void audio.play().catch(() => URL.revokeObjectURL(url))
  }

  const wipe = async () => {
    await deleteAllClips()
    setHeard(heard.map((h) => ({ ...h, clip: false })))
    refreshStats()
  }

  return (
    <section className="pa-card" aria-labelledby="pa-heard-h">
      <h2 id="pa-heard-h" className="pa-label">What the mic heard</h2>
      {heard.length === 0 ? (
        <p className="pa-note">After {name} plays, the last 10 sounds the mic caught show up here.</p>
      ) : (
        <>
          <p className="pa-note">Tell the app who it was and it gets better at telling you apart.</p>
          <ul className="pa-heard">
            {[...heard].reverse().map((h) => (
              <li key={h.id} className="pa-heard-row">
                <div className="pa-heard-what">
                  <span className="pa-heard-time">{time(h.id)}</span>
                  <span className="pa-setting-name">{FIRED[h.fired] ?? h.fired}</span>
                  {h.target && <span className="pa-note">during “{h.target}”</span>}
                </div>
                <div className="pa-add-actions">
                  {h.clip && (
                    <button type="button" className="parent-btn" onClick={() => void play(h.id)} aria-label={`Play the sound from ${time(h.id)}`}>
                      play
                    </button>
                  )}
                  <button type="button" className={`pa-chip${h.said === 'child' ? ' pa-chip--on' : ''}`} aria-pressed={h.said === 'child'} onClick={() => say(h, 'child')}>
                    that was {name}
                  </button>
                  <button type="button" className={`pa-chip${h.said === 'parent' ? ' pa-chip--on' : ''}`} aria-pressed={h.said === 'parent'} onClick={() => say(h, 'parent')}>
                    that was me
                  </button>
                  {h.target && <RecordWord word={h.target} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="pa-setting">
        <div>
          <div className="pa-setting-name" id="pa-clips-name">Keep recordings</div>
          <div className="pa-note">
            Saves up to 5 seconds of each sound on this tablet so you can play it back. Nothing is uploaded, and you can delete them any time.
          </div>
        </div>
        <button type="button" role="switch" className="pa-switch" aria-checked={settings.keepClips} aria-labelledby="pa-clips-name" onClick={() => set({ keepClips: !settings.keepClips })}>
          <span />
        </button>
      </div>
      {stats.count > 0 && (
        <div className="pa-setting">
          <span className="pa-note">
            {stats.count} {stats.count === 1 ? 'recording' : 'recordings'} · {mb(stats.bytes)}
          </span>
          <button type="button" className="parent-btn" onClick={() => void wipe()}>
            Delete all recordings
          </button>
        </div>
      )}
    </section>
  )
}
