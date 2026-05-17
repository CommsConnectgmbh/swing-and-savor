import { useEffect, useRef, useState } from 'react'
import { searchCourses, coursesNear, createCourse, getCurrentLocation, importCoursesFromUpstream, seedFromOsmNear } from '../lib/courses'

export default function CoursePicker({ value, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('search') // 'search' | 'nearby' | 'new'
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [newForm, setNewForm] = useState({ name: '', city: '', country: '' })
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (mode !== 'search') return
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setResults(await searchCourses(query))
      setLoading(false)
    }, 220)
    return () => clearTimeout(timerRef.current)
  }, [query, mode])

  async function loadNearby(seedIfEmpty = false) {
    setMode('nearby'); setGeoBusy(true); setGeoError(null); setResults([])
    const pos = await getCurrentLocation()
    if (!pos) {
      setGeoError('Standort nicht verfügbar — bitte in Browser-Einstellungen erlauben')
      setGeoBusy(false); return
    }
    setLoading(true)
    let near = await coursesNear(pos.lat, pos.lng, 50)
    if (near.length === 0 && seedIfEmpty) {
      // Try to pull from OSM (~5–30s for unseeded region) and re-query
      await seedFromOsmNear(pos.lat, pos.lng, 50)
      near = await coursesNear(pos.lat, pos.lng, 50)
    }
    setResults(near)
    setLoading(false); setGeoBusy(false)
  }

  async function submitNew(e) {
    e.preventDefault()
    setCreateErr(null)
    if (!newForm.name.trim()) { setCreateErr('Name ist Pflicht'); return }
    setCreating(true)
    try {
      const pos = await getCurrentLocation().catch(() => null)
      const c = await createCourse({
        name: newForm.name,
        city: newForm.city,
        country: newForm.country,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
      })
      onChange(c)
      onClose?.()
    } catch (err) {
      setCreateErr(err.message || 'Anlegen fehlgeschlagen')
    } finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 animate-fade-up"
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-lg mx-auto rounded-t-2xl bg-surface border-t border-x border-line shadow-lift max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-inkMuted">Golfplatz wählen</p>
          <button onClick={onClose} className="text-inkMuted text-xl leading-none active:scale-90 transition-transform">×</button>
        </div>

        {/* Mode tabs */}
        <div className="px-3 pb-3 flex gap-2">
          <TabBtn label="Suchen"   active={mode==='search'} onClick={() => { setMode('search'); setResults([]) }} />
          <TabBtn label="In der Nähe" active={mode==='nearby'} onClick={() => loadNearby()} />
          <TabBtn label="+ Neu"    active={mode==='new'}    onClick={() => { setMode('new'); setResults([]); setCreateErr(null) }} />
        </div>

        {/* Search input */}
        {mode === 'search' && (
          <div className="px-3 pb-3">
            <input
              type="text" autoFocus autoCapitalize="off" autoCorrect="off"
              placeholder="Platzname tippen…"
              className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
        )}

        {mode === 'nearby' && geoBusy && (
          <p className="text-center text-xs text-inkDim py-4">Suche Plätze in deiner Nähe…</p>
        )}
        {mode === 'nearby' && geoError && (
          <p className="text-center text-xs text-danger py-4 px-4">{geoError}</p>
        )}

        {/* New course form */}
        {mode === 'new' && (
          <form onSubmit={submitNew} className="px-3 pb-3 flex flex-col gap-2">
            <input type="text" autoFocus placeholder="Platzname *"
              className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
              value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Stadt"
                className="bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
                value={newForm.city} onChange={e => setNewForm(f => ({ ...f, city: e.target.value }))} />
              <input type="text" placeholder="Land"
                className="bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
                value={newForm.country} onChange={e => setNewForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <p className="text-[10px] text-inkDim pl-1">Standort wird (falls erlaubt) aus deiner aktuellen Position übernommen — sonst kannst du später am Platz die Position setzen.</p>
            {createErr && <p className="text-xs text-danger pl-1">{createErr}</p>}
            <button type="submit" disabled={creating}
              className="py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
              {creating ? 'Lege an…' : 'Platz anlegen & übernehmen'}
            </button>
          </form>
        )}

        {/* Result list */}
        {(mode === 'search' || mode === 'nearby') && (
          <div className="flex-1 overflow-y-auto border-t border-lineSoft">
            {loading && <p className="text-center text-xs text-inkDim py-4">Suche…</p>}
            {!loading && results.length === 0 && mode === 'search' && query.length >= 2 && (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-inkMuted">Kein Platz gefunden</p>
                <button
                  onClick={async () => {
                    setLoading(true)
                    const imported = await importCoursesFromUpstream(query)
                    if (imported.length) setResults(imported)
                    setLoading(false)
                  }}
                  className="mt-2 text-xs text-accent font-semibold block mx-auto">
                  Weltweit suchen
                </button>
                <button onClick={() => { setNewForm(f => ({ ...f, name: query })); setMode('new') }}
                  className="mt-2 text-xs text-inkMuted">+ „{query}" neu anlegen</button>
              </div>
            )}
            {!loading && results.length === 0 && mode === 'nearby' && !geoBusy && !geoError && (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-inkMuted">Noch keine Plätze im 50-km-Radius</p>
                <button onClick={() => loadNearby(true)}
                  className="mt-2 text-xs text-accent font-semibold block mx-auto">
                  Aus OpenStreetMap nachladen
                </button>
                <p className="text-[10px] text-inkDim mt-1">Dauert ein paar Sekunden</p>
              </div>
            )}
            {results.map((c, idx) => (
              <button key={c.id}
                onClick={() => { onChange(c); onClose?.() }}
                className={`w-full text-left px-4 py-3 active:bg-bg/40 transition-colors flex items-center justify-between gap-3 ${idx < results.length - 1 ? 'border-b border-lineSoft' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-ink truncate flex items-center gap-1.5">
                    {c.name}
                    {value?.id === c.id && <span className="text-accent text-xs">✓</span>}
                  </p>
                  <p className="text-xs text-inkMuted truncate">
                    {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    {c.total_par > 0 && <span className="text-inkDim"> · Par {c.total_par}</span>}
                    {c.distance_m && <span className="text-inkDim"> · {(c.distance_m/1000).toFixed(1)} km</span>}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" className="text-inkDim flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold tracking-wide active:scale-[0.97] transition-all ${
        active ? 'bg-accent text-brandDark' : 'bg-bg text-inkMuted border border-line'
      }`}>
      {label}
    </button>
  )
}
