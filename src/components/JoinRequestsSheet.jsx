import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function JoinRequestsSheet({ cup, onClose, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { load() }, [cup.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tournament_join_requests')
      .select('id, status, display_name, handicap, message, rules_accepted_at, profile_id, created_at')
      .eq('tournament_id', cup.id)
      .order('created_at', { ascending: false })
    if (data?.length) {
      const ids = [...new Set(data.map(r => r.profile_id))]
      const { data: profs } = await supabase.from('profiles')
        .select('id, handle, display_name, avatar_url, hcp').in('id', ids)
      const byId = Object.fromEntries((profs || []).map(p => [p.id, p]))
      setRows(data.map(r => ({ ...r, profile: byId[r.profile_id] })))
    } else { setRows([]) }
    setLoading(false)
  }

  async function approve(req, team='A') {
    setBusyId(req.id)
    try {
      const { error } = await supabase.rpc('approve_join_request', {
        req_id: req.id, team_letter: team,
      })
      if (error) throw error
      await load(); onChanged?.()
    } catch (e) {
      alert(e.message || 'Approve failed')
    } finally { setBusyId(null) }
  }

  async function reject(req) {
    setBusyId(req.id)
    try {
      await supabase.from('tournament_join_requests')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', req.id)
      await load(); onChanged?.()
    } finally { setBusyId(null) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-line max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-lineSoft flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">Beitritts-Anfragen</p>
            <p className="font-condensed font-bold text-xl text-ink truncate">{cup.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-inkMuted active:scale-90 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-3 py-2">
          {loading && <div className="py-10 text-center text-inkMuted text-xs">Lade …</div>}
          {!loading && rows.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-inkMuted">Keine Anfragen.</p>
              <p className="text-xs text-inkDim mt-1">
                Beitritte über Code (Privat) oder Mitspielen-Button (Offen/Anfrage).
              </p>
            </div>
          )}
          {rows.map(r => (
            <div key={r.id}
              className="px-3 py-3 border-b border-lineSoft last:border-b-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-bg overflow-hidden flex-shrink-0 border border-line">
                {r.profile?.avatar_url
                  ? <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center text-xs font-bold text-inkMuted">
                      {(r.profile?.display_name || r.display_name || '?').slice(0,1)}
                    </div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink truncate">
                  {r.display_name || r.profile?.display_name || 'Spieler'}
                  {r.profile?.handle && <span className="text-inkDim font-normal text-xs"> · @{r.profile.handle}</span>}
                </p>
                <p className="text-[11px] text-inkMuted">
                  HC {r.handicap ?? r.profile?.hcp ?? '—'} · Anfrage {new Date(r.created_at).toLocaleDateString('de-DE')}
                  {r.status !== 'pending' && <span className="ml-2 text-accent">· {r.status}</span>}
                </p>
                {r.message && <p className="text-[11px] text-ink mt-1 italic">„{r.message}"</p>}
              </div>
              {r.status === 'pending' && (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <div className="flex gap-1">
                    <button disabled={busyId === r.id}
                      onClick={() => approve(r, 'A')}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-teamA/20 text-teamA border border-teamA/40 active:scale-95 disabled:opacity-50">
                      +Team A
                    </button>
                    <button disabled={busyId === r.id}
                      onClick={() => approve(r, 'B')}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-teamB/20 text-teamB border border-teamB/40 active:scale-95 disabled:opacity-50">
                      +Team B
                    </button>
                  </div>
                  <button disabled={busyId === r.id}
                    onClick={() => reject(r)}
                    className="text-[10px] font-bold px-2 py-1 rounded bg-danger/12 text-danger border border-danger/30 active:scale-95 disabled:opacity-50">
                    Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
