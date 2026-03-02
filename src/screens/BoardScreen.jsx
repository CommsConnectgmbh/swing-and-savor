import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcTeamPoints, calcMatchStanding } from '../lib/scoring'
import LoadingSpinner from '../components/LoadingSpinner'

export default function BoardScreen() {
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [holesByMatch, setHolesByMatch] = useState({})
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    loadData()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function loadData() {
    const { data: t } = await supabase.from('tournaments')
      .select('*').eq('status', 'active').order('date', { ascending: false }).limit(1).maybeSingle()

    if (!t) { setLoading(false); return }
    setTournament(t)

    const { data: m } = await supabase.from('matches').select(`
      *,
      pa1:team_a_player1_id(name),
      pa2:team_a_player2_id(name),
      pb1:team_b_player1_id(name),
      pb2:team_b_player2_id(name)
    `).eq('tournament_id', t.id).order('created_at')

    const matchList = m || []
    setMatches(matchList)

    if (matchList.length > 0) {
      const { data: holes } = await supabase.from('hole_results')
        .select('*').in('match_id', matchList.map(x => x.id)).order('hole_number')
      const byMatch = {}
      for (const h of (holes || [])) {
        if (!byMatch[h.match_id]) byMatch[h.match_id] = []
        byMatch[h.match_id].push(h)
      }
      setHolesByMatch(byMatch)
    }

    setLoading(false)
    subscribeRealtime(t.id)
  }

  function subscribeRealtime(tournamentId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(`board-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_results' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
      .subscribe()
    channelRef.current = channel
  }

  if (loading) return <div className="p-4 pt-8"><LoadingSpinner /></div>

  if (!tournament) return (
    <div className="p-4 pt-8 text-center">
      <div className="text-6xl mb-4">🏆</div>
      <p className="text-muted">Kein aktives Turnier.</p>
      <p className="text-muted text-sm mt-1">Erstelle eines unter Cup.</p>
    </div>
  )

  const points = calcTeamPoints(matches)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-6 pb-4 text-center">
        <div className="text-muted text-xs uppercase tracking-widest mb-1">
          {new Date(tournament.date).toLocaleDateString('de-DE')}
        </div>
        <h1 className="text-xl font-bold">{tournament.name}</h1>
      </div>

      {/* Team score */}
      <div className="bg-surface border border-border rounded-3xl p-6 mb-6">
        <div className="grid grid-cols-3 items-center">
          <div className="text-center">
            <div className="text-muted text-xs uppercase tracking-widest mb-2 truncate">{tournament.team_a_name}</div>
            <div className="text-6xl font-black text-accent">
              {points.A % 1 === 0 ? points.A : points.A.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted text-2xl">vs</div>
            <div className="text-muted text-xs mt-1">{matches.length} Matches</div>
          </div>
          <div className="text-center">
            <div className="text-muted text-xs uppercase tracking-widest mb-2 truncate">{tournament.team_b_name}</div>
            <div className="text-6xl font-black text-white">
              {points.B % 1 === 0 ? points.B : points.B.toFixed(1)}
            </div>
          </div>
        </div>
        {matches.length > 0 && (
          <div className="mt-4 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(points.A / matches.length) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Match cards */}
      <div className="flex flex-col gap-3">
        {matches.map(m => {
          const holes = holesByMatch[m.id] || []
          const standing = calcMatchStanding(holes)
          const tA = [m.pa1?.name, m.pa2?.name].filter(Boolean).join(' / ')
          const tB = [m.pb1?.name, m.pb2?.name].filter(Boolean).join(' / ')
          const standingColor = m.status === 'finished'
            ? (m.winner === 'A' ? 'text-accent' : m.winner === 'B' ? 'text-danger' : 'text-warn')
            : (standing.leader === 'A' ? 'text-accent' : standing.leader === 'B' ? 'text-danger' : 'text-white')

          return (
            <div key={m.id}
              className="bg-surface border border-border rounded-2xl p-4 active:opacity-70"
              onClick={() => navigate(`/matches/${m.id}`)}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-muted">{m.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</span>
                <span className={`text-xs font-medium ` +
                  (m.status === 'finished' ? 'text-accent' : m.status === 'active' ? 'text-warn' : 'text-muted')}>
                  {m.status === 'finished' ? 'Beendet' : m.status === 'active' ? `Loch ${holes.length}` : 'Ausstehend'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tA || '—'}</div>
                  <div className="text-xs text-muted mt-0.5 truncate">{tB || '—'}</div>
                </div>
                <div className={`text-2xl font-black ml-4 ` + standingColor}>
                  {m.status === 'finished'
                    ? (m.winner === 'halved' ? '½' : standing.label)
                    : (holes.length > 0 ? standing.label : '—')}
                </div>
              </div>
            </div>
          )
        })}
        {matches.length === 0 && <p className="text-muted text-center py-8">Noch keine Matches angelegt.</p>}
      </div>
    </div>
  )
}
