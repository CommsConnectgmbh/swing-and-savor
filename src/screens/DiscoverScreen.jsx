import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import LoadingSpinner from '../components/LoadingSpinner'

export default function DiscoverScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, date, status, team_a_name, team_b_name, visibility, owner_id, invite_code')
      .order('date', { ascending: false })
      .limit(30)
    // Visibility filter happens via RLS; here we sort active first
    const list = data ?? []
    list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return new Date(b.date) - new Date(a.date)
    })
    // Enrich with owner profile (single batched lookup)
    const ownerIds = [...new Set(list.map(t => t.owner_id).filter(Boolean))]
    let byOwner = {}
    if (ownerIds.length) {
      const { data: owners } = await supabase
        .from('profiles').select('id, handle, display_name').in('id', ownerIds)
      byOwner = Object.fromEntries((owners ?? []).map(p => [p.id, p]))
    }
    setFeed(list.map(t => ({ ...t, owner: byOwner[t.owner_id] })))
    setLoading(false)
  }

  async function joinByCode(e) {
    e.preventDefault()
    setJoinError(null)
    const code = joinCode.trim().toLowerCase()
    if (code.length !== 8) { setJoinError('Code ist 8 Zeichen'); return }
    const { data, error } = await supabase
      .from('tournaments').select('id').eq('invite_code', code).maybeSingle()
    if (error || !data) { setJoinError('Code unbekannt'); return }
    // Add invite for current user (idempotent)
    if (user) {
      await supabase.from('tournament_invites').upsert({
        tournament_id: data.id, profile_id: user.id, invited_by: user.id,
      }, { onConflict: 'tournament_id,profile_id' })
    }
    navigate('/board')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Entdecken</h1>
        <p className="text-xs text-inkMuted mt-0.5">Öffentliche Turniere & Freunde-Spiele</p>
      </div>

      {/* Join by code */}
      <form onSubmit={joinByCode} className="mx-3 mb-4 p-3 rounded-card bg-surface border border-line flex gap-2">
        <input
          type="text" autoCapitalize="none" autoCorrect="off"
          placeholder="Einladungs-Code"
          className="flex-1 bg-bg border border-line rounded-lg px-3 py-2 text-ink placeholder:text-inkDim text-sm focus:border-accent/60 lowercase tabular-nums tracking-[0.2em]"
          value={joinCode}
          maxLength={8}
          onChange={e => { setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')); setJoinError(null) }}
        />
        <button type="submit"
          className="px-4 rounded-lg text-xs font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform">
          Beitreten
        </button>
      </form>
      {joinError && <p className="px-4 -mt-2 mb-3 text-xs text-danger">{joinError}</p>}

      {/* Feed */}
      <div className="border-t border-lineSoft">
        {feed.map((t, idx) => (
          <button key={t.id}
            onClick={() => navigate('/board')}
            className="w-full text-left px-4 py-4 border-b border-lineSoft active:bg-surface/50 transition-colors flex items-center gap-3"
            style={{ animationDelay: `${idx * 25}ms` }}>
            <div className="flex-shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${
                t.status === 'active' ? 'bg-accent animate-pulse' : 'bg-line'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-ink truncate">{t.name}</p>
                <VisibilityBadge v={t.visibility} />
              </div>
              <p className="text-xs text-inkMuted mt-0.5 truncate">
                {new Date(t.date + 'T12:00:00').toLocaleDateString('de-DE')}
                {' · '}
                <span className="text-teamA">{t.team_a_name}</span>
                {' vs '}
                <span className="text-teamB">{t.team_b_name}</span>
                {t.owner && <span className="text-inkDim"> · von @{t.owner.handle}</span>}
              </p>
            </div>
          </button>
        ))}
        {feed.length === 0 && (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-inkMuted">Noch keine sichtbaren Turniere</p>
            <p className="text-xs mt-1 text-inkDim">
              Leg eins selbst an unter <span className="text-accent font-semibold">Cup</span> oder tritt mit Code bei.
            </p>
          </div>
        )}
      </div>
      <div className="h-6" />
    </div>
  )
}

function VisibilityBadge({ v }) {
  if (v === 'public') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-accent bg-accent/12 border border-accent/30">Öffentlich</span>
  if (v === 'friends') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-teamA bg-teamA/12 border border-teamA/30">Freunde</span>
  if (v === 'private') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-lock bg-lock/12 border border-lock/30">Privat</span>
  return null
}
