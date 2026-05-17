import { useState } from 'react'
import { applyCourseEdit } from '../lib/courses'

// Normalize an 18-entry int array, with fallback default.
function fillArr(arr, len = 18, fallback = 0) {
  const out = Array.from({ length: len }, (_, i) => {
    const v = arr?.[i]
    return Number.isFinite(v) ? v : fallback
  })
  return out
}

export default function CourseEditor({ course, sourceMatchId = null, onClose, onSaved }) {
  const [pars,  setPars]  = useState(() => fillArr(course?.hole_pars, 18, 4))
  const [hcps,  setHcps]  = useState(() => fillArr(course?.hole_handicaps, 18, 0))
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState(null)

  const totalPar = pars.reduce((s, p) => s + (p || 0), 0)

  function updatePar(i, delta) {
    setPars(p => p.map((v, idx) => idx === i ? Math.max(3, Math.min(6, v + delta)) : v))
  }
  function updateHcp(i, value) {
    const v = parseInt(value) || 0
    setHcps(arr => arr.map((x, idx) => idx === i ? Math.max(0, Math.min(18, v)) : x))
  }

  async function save() {
    setError(null); setBusy(true)
    try {
      const updated = await applyCourseEdit(course.id, pars, hcps, sourceMatchId)
      onSaved?.(updated)
      onClose?.()
    } catch (e) {
      setError(e.message || 'Speichern fehlgeschlagen')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 animate-fade-up"
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-lg mx-auto rounded-t-2xl bg-surface border-t border-x border-line shadow-lift max-h-[88vh] overflow-hidden flex flex-col">

        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">Scorekarte bearbeiten</p>
            <p className="font-semibold text-sm text-ink truncate">{course?.name}</p>
          </div>
          <button onClick={onClose} className="text-inkMuted text-xl leading-none active:scale-90 transition-transform">×</button>
        </div>

        <div className="px-4 py-2 grid grid-cols-[40px_1fr_70px] gap-2 text-[10px] font-bold tracking-[0.16em] uppercase text-inkMuted border-b border-lineSoft">
          <span>Loch</span><span className="text-center">Par</span><span className="text-center">HCP</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pars.map((p, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_70px] gap-2 items-center px-4 py-2 border-b border-lineSoft">
              <span className="text-sm text-inkMuted font-condensed font-bold tabular-nums">{i + 1}</span>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => updatePar(i, -1)} disabled={p <= 3}
                  className="w-9 h-9 rounded-lg bg-bg text-inkMuted text-base font-bold active:scale-90 transition-transform disabled:opacity-30">–</button>
                <span className="font-condensed font-black text-xl text-ink tabular-nums w-6 text-center">{p}</span>
                <button onClick={() => updatePar(i, +1)} disabled={p >= 6}
                  className="w-9 h-9 rounded-lg bg-bg text-inkMuted text-base font-bold active:scale-90 transition-transform disabled:opacity-30">+</button>
              </div>
              <input
                type="number" min="0" max="18" inputMode="numeric"
                placeholder="–"
                className="w-full bg-bg border border-line rounded-lg px-2 py-1.5 text-center text-ink text-sm tabular-nums focus:border-accent/60"
                value={hcps[i] || ''}
                onChange={e => updateHcp(i, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-lineSoft bg-bg/40 flex items-center justify-between">
          <div className="text-xs text-inkMuted">
            Gesamt-Par: <span className="text-accent font-bold tabular-nums">{totalPar}</span>
          </div>
          {course?.contributor_count > 0 && (
            <p className="text-[10px] text-inkDim">{course.contributor_count} Bearbeitungen</p>
          )}
        </div>

        {error && <p className="px-4 pb-2 text-xs text-danger">{error}</p>}

        <div className="px-3 pb-4 pt-2 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
            Abbrechen
          </button>
          <button onClick={save} disabled={busy}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
            {busy ? 'Speichere…' : 'Für alle speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
