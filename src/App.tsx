import { useCallback, useEffect, useRef, useState } from 'react'
import { MIXED_POOL, type ActivityId } from './data/content'
import { importLegacyPhotos, loadSettings, saveSettings, type Settings } from './data/settings'
import { appendRecord, loadLog, weekSummary } from './data/log'
import { addStar, loadGarden } from './data/garden'
import { getAllTargetImages } from './data/imageStore'
import { pickNext } from './engine/session'
import { speak } from './audio/voice'
import { ActivityFrame } from './activities/ActivityFrame'
import { ACTIVITY_COMPONENTS } from './activities'
import { Home } from './screens/Home'
import { AllDone } from './screens/AllDone'
import { Parent } from './screens/Parent'

type View = 'home' | 'parent' | 'alldone' | { activity: ActivityId; mixed?: { endsAt: number; last: ActivityId | null } }

function boot() {
  let firstRun = false
  try {
    firstRun = !globalThis.localStorage.getItem('alexspeak.v2.settings')
  } catch {
    // storage blocked: treat as an existing install, skip the photo import
  }
  return { firstRun, settings: loadSettings() }
}

export default function App() {
  const [start] = useState(boot)
  const [settings, setSettings] = useState<Settings>(start.settings)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [garden, setGarden] = useState(loadGarden)
  const [view, setView] = useState<View>('home')
  const [nonce, setNonce] = useState(0)
  const [done, setDone] = useState<{ since: number; ms: number; grew: boolean } | null>(null)
  const session = useRef({ startedAt: 0, grew: false })
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    void getAllTargetImages().then((p) => {
      setPhotos(p)
      if (!start.firstRun) return
      // One-time upgrade: old photos become motivators. The old store is left untouched.
      setSettings((s) => {
        const next = importLegacyPhotos(s, Object.keys(p))
        if (next !== s) saveSettings(next)
        return next
      })
    })
  }, [start])

  // Photos added in Set up reach the activities on the way back home.
  const atHome = view === 'home'
  useEffect(() => {
    if (atHome) void getAllTargetImages().then(setPhotos, () => {})
  }, [atHome])

  useEffect(() => {
    document.documentElement.dataset.calm = String(settings.calm)
  }, [settings.calm])

  const begin = (activity: ActivityId, mixed?: { endsAt: number; last: ActivityId | null }) => {
    session.current = { startedAt: Date.now(), grew: false }
    setNonce((n) => n + 1)
    setView({ activity, mixed })
  }

  const finish = useCallback((showDone: boolean) => {
    const { startedAt, grew } = session.current
    const ms = Date.now() - startedAt
    appendRecord({ kind: 'session', t: Date.now(), ms })
    if (!showDone) return setView('home')
    setDone({ since: startedAt, ms, grew })
    setView('alldone')
    void speak('all done!', settings)
  }, [settings])

  const onDone = useCallback(() => {
    const v = viewRef.current
    if (typeof v !== 'object' || !v.mixed) return
    if (Date.now() >= v.mixed.endsAt) return finish(true)
    const next = pickNext(MIXED_POOL, weekSummary(loadLog()).byActivity, v.activity)
    setView({ activity: next, mixed: { ...v.mixed, last: v.activity } })
  }, [finish])

  const onStar = useCallback(() => {
    const r = addStar()
    setGarden(r.garden)
    if (r.grew) session.current.grew = true
  }, [])

  const onParent = useCallback(() => setView('parent'), [])

  if (view === 'home') {
    return (
      <Home
        childName={settings.childName}
        stars={garden.stars}
        onPlay={() => {
          const first = pickNext(MIXED_POOL, weekSummary(loadLog()).byActivity, null)
          begin(first, { endsAt: Date.now() + settings.sessionMinutes * 60_000, last: null })
        }}
        onActivity={(id) => begin(id)}
        onParent={onParent}
      />
    )
  }

  if (view === 'alldone' && done) {
    return <AllDone childName={settings.childName} garden={garden} grew={done.grew} since={done.since} ms={done.ms} onHome={() => setView('home')} />
  }

  if (view === 'parent' || view === 'alldone') {
    return (
      <Parent
        settings={settings}
        onChange={(s) => {
          saveSettings(s)
          setSettings(s)
        }}
        onClose={() => setView('home')}
      />
    )
  }

  const Activity = ACTIVITY_COMPONENTS[view.activity]
  return (
    <ActivityFrame
      key={`${view.activity}-${nonce}`}
      activity={view.activity}
      settings={settings}
      photos={photos}
      onExit={() => finish(false)}
      onStar={onStar}
    >
      {(api) => <Activity api={api} settings={settings} photos={photos} onDone={onDone} />}
    </ActivityFrame>
  )
}
