import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { subscribeToTables } from '../lib/realtime'
import { calcTeamPoints, calcMatchStanding } from '../lib/scoring'
import { fmtPts, formatCupDate } from '../lib/format'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'
import { isUnlocked } from '../lib/tournamentGate'

const TEAM_A = '#60a5fa'
const TEAM_B = '#fb7185'
const LIVE   = '#D9C9A8'

export default function BoardScreen() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [holesByMatch, setHolesByMatch] = useState({})
  const [loading, setLoading] = useState(true)
  const [showViewGate, setShowViewGate] = useState(false)
  const channelRef = useRef(null)
  const selectedIdRef = useRef(null)

  useEffect(() => {
    loadTournaments()
    return () => { channelRef.current?.() }
  }, [])

  async function loadTournaments() {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    const list = data || []
    setTournaments(list)
    if (list.length === 0) { setLoading(false); return }
    const active = list.find(t => t.status === 'active') || list[0]
    setTournament(active)
    selectedIdRef.current = active.id
    if (isUnlocked(active)) {
      await loadMatchData(active.id)
      subscribeRealtime(active.id)
    } else {
      setLoading(false)
      setShowViewGate(true)
    }
  }

  async function loadMatchData(tournamentId) {
    const [{ data: m }, { data: pl }] = await Promise.all([
      supabase.from('matches').select(`
        *,
        pa1:team_a_player1_id(name),
        pa2:team_a_player2_id(name),
        pb1:team_b_player1_id(name),
        pb2:team_b_player2_id(name)
      `).eq('tournament_id', tournamentId).order('created_at'),
      supabase.from('players').select('id,name').eq('tournament_id', tournamentId),
    ])
    const nameById = Object.fromEntries((pl || []).map(p => [p.id, p.name]))
    const matchList = (m || []).map(mm => ({
      ...mm,
      _namesA: (mm.team_a_player_ids?.length ? mm.team_a_player_ids
                : [mm.team_a_player1_id, mm.team_a_player2_id].filter(Boolean))
                .map(id => nameById[id]).filter(Boolean),
      _namesB: (mm.team_b_player_ids?.length ? mm.team_b_player_ids
                : [mm.team_b_player1_id, mm.team_b_player2_id].filter(Boolean))
                .map(id => nameById[id]).filter(Boolean),
    }))
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
    } else {
      setHolesByMatch({})
    }

    setLoading(false)
  }

  async function selectTournament(t) {
    if (t.id === selectedIdRef.current) return
    setTournament(t)
    selectedIdRef.current = t.id
    setMatches([])
    setHolesByMatch({})
    if (isUnlocked(t)) {
      setShowViewGate(false)
      setLoading(true)
      await loadMatchData(t.id)
      subscribeRealtime(t.id)
    } else {
      setLoading(false)
      setShowViewGate(true)
    }
  }

  async function handleViewGateSuccess() {
    setShowViewGate(false)
    setLoading(true)
    await loadMatchData(selectedIdRef.current)
    subscribeRealtime(selectedIdRef.current)
  }

  function subscribeRealtime(tournamentId) {
    channelRef.current?.()
    channelRef.current = subscribeToTables(`board-${tournamentId}`, [
      { table: 'hole_results', handler: () => {
        if (selectedIdRef.current === tournamentId) loadMatchData(tournamentId)
      } },
      { table: 'matches', handler: () => {
        if (selectedIdRef.current === tournamentId) loadMatchData(tournamentId)
      } },
    ])
  }

  if (loading) return <LoadingSpinner />

  if (!tournament) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-up">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-surface border border-line">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D9C9A8" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v6a6 6 0 01-12 0V3z"/>
          <path d="M6 9H4a2 2 0 000 4h2M18 9h2a2 2 0 010 4h-2"/>
          <line x1="12" y1="15" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>
        </svg>
      </div>
      <p className="font-bold text-ink text-lg">Noch kein Turnier</p>
      <p className="text-sm mt-1.5 text-inkMuted max-w-xs">
        Leg dein erstes Match Play Turnier an — Teams, Spieler, Live-Scoring.
      </p>
      <button
        onClick={() => navigate('/cup?new=1')}
        className="mt-6 px-6 py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.97] transition-transform shadow-glow"
      >
        + Turnier anlegen
      </button>
    </div>
  )

  // Locked placeholder
  if (!isUnlocked(tournament) && !showViewGate) return (
    <div className="max-w-lg mx-auto animate-fade-up flex flex-col items-center justify-center py-20 px-8 gap-4">
      {tournaments.length > 1 && (
        <div className="w-full mb-4">
          <select
            className="w-full rounded-xl px-4 py-3 text-ink text-sm bg-surface border border-line"
            value={tournament.id}
            onChange={e => { const t = tournaments.find(x => x.id === e.target.value); if (t) selectTournament(t) }}
          >
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-lock/10 border border-lock/30">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5b94a"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm text-ink">Turnier geschützt</p>
        <p className="text-xs mt-1 text-inkMuted">Passwort eingeben, um das Scoreboard zu sehen</p>
      </div>
      <button onClick={() => setShowViewGate(true)}
        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
        Passwort eingeben
      </button>
      {showViewGate && tournament && (
        <PasswordGate
          viewMode
          tournamentId={tournament.id}
          onSuccess={handleViewGateSuccess}
          onCancel={() => setShowViewGate(false)}
        />
      )}
    </div>
  )

  const points = calcTeamPoints(matches, holesByMatch)
  const leaderA = points.A > points.B
  const leaderB = points.B > points.A
  const liveCount = matches.filter(m => m.status === 'active').length
  const finCount  = matches.filter(m => m.status === 'finished').length

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* ── tournament header ── */}
      <div className="text-center pt-6 pb-3 px-4">
        <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-inkDim">
          {formatCupDate(tournament.date, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="font-condensed text-3xl font-bold tracking-wide mt-1 text-ink">{tournament.name}</h1>

        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`text-[10px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full ${
            tournament.status === 'active'
              ? 'bg-accent/12 text-accent border border-accent/25'
              : 'bg-surface text-inkDim border border-line'
          }`}>
            {tournament.status === 'active' ? 'Aktiv' : 'Beendet'}
          </span>
        </div>
      </div>

      {/* ── tournament selector ── */}
      {tournaments.length > 1 && (
        <div className="px-3 mb-4">
          <select
            className="w-full rounded-xl px-4 py-3 text-ink text-sm bg-surface border border-line"
            value={tournament.id}
            onChange={e => {
              const t = tournaments.find(x => x.id === e.target.value)
              if (t) selectTournament(t)
            }}
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── score hero ── */}
      <div className="mx-3 mb-4 rounded-card overflow-hidden bg-surface border border-line shadow-lift">
        <div className="flex items-stretch">

          {/* Team A */}
          <div className="flex-1 text-center py-5 px-3"
            style={{ background: 'rgba(155,181,201,0.07)', borderRight: '1px solid #15302A' }}>
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase mb-3 truncate" style={{ color: TEAM_A }}>
              {tournament.team_a_name}
            </p>
            <p
              className="font-condensed font-black leading-none tabular-nums"
              style={{
                fontSize: '4.5rem',
                color: leaderA ? TEAM_A : '#e5e7eb',
                filter: leaderA ? `drop-shadow(0 0 20px rgba(155,181,201,0.5))` : 'none',
              }}
            >
              {fmtPts(points.A)}
            </p>
          </div>

          {/* Center divider */}
          <div className="flex flex-col items-center justify-center px-3 py-5">
            <span className="font-condensed font-bold text-xl text-line">—</span>
          </div>

          {/* Team B */}
          <div className="flex-1 text-center py-5 px-3"
            style={{ background: 'rgba(217,163,142,0.07)', borderLeft: '1px solid #15302A' }}>
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase mb-3 truncate" style={{ color: TEAM_B }}>
              {tournament.team_b_name}
            </p>
            <p
              className="font-condensed font-black leading-none tabular-nums"
              style={{
                fontSize: '4.5rem',
                color: leaderB ? TEAM_B : '#e5e7eb',
                filter: leaderB ? `drop-shadow(0 0 20px rgba(217,163,142,0.5))` : 'none',
              }}
            >
              {fmtPts(points.B)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {matches.length > 0 && (() => {
          const total = matches.length
          const pctA = (points.A / total) * 100
          const pctB = (points.B / total) * 100
          return (
            <div className="h-[3px] flex bg-lineSoft">
              <div className="h-full transition-all duration-700" style={{ width: `${pctA}%`, background: TEAM_A }} />
              <div className="h-full transition-all duration-700" style={{ width: `${pctB}%`, background: TEAM_B, marginLeft: 'auto' }} />
            </div>
          )
        })()}

        {/* Stats row */}
        <div className="flex justify-center gap-6 py-2.5">
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-inkMuted tabular-nums">
            {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
          </span>
          {liveCount > 0 && (
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase flex items-center gap-1.5 text-accent tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-accent" />
              {liveCount} Live
            </span>
          )}
          {finCount > 0 && (
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-inkMuted tabular-nums">
              {finCount} Beendet
            </span>
          )}
        </div>
      </div>

      {/* ── section label ── */}
      {matches.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">Matches</p>
        </div>
      )}

      {/* ── match cards ── */}
      <div className="mx-3 rounded-card overflow-hidden bg-surface border border-line">
        {matches.map((m, idx) => {
          const holes    = holesByMatch[m.id] || []
          const standing = calcMatchStanding(holes)
          const playersA = (m._namesA?.length ? m._namesA : [m.pa1?.name, m.pa2?.name].filter(Boolean)).join(' · ')
          const playersB = (m._namesB?.length ? m._namesB : [m.pb1?.name, m.pb2?.name].filter(Boolean)).join(' · ')
          const typeLbl  = m.type === 'singles' ? 'Singles'
                          : m.type === 'doubles' ? 'Doubles'
                          : `Flight ${m._namesA?.length ?? 0}v${m._namesB?.length ?? 0}`
          const hasFactor = Number(m.team_a_factor ?? 1) !== 1 || Number(m.team_b_factor ?? 1) !== 1

          let standColor = '#9C968C'
          let standBg = 'transparent'

          if (m.status === 'finished') {
            if (m.winner === 'A')      { standColor = TEAM_A; standBg = 'rgba(155,181,201,0.12)' }
            else if (m.winner === 'B') { standColor = TEAM_B; standBg = 'rgba(217,163,142,0.12)' }
            else                       { standColor = '#9C968C'; standBg = 'rgba(168,181,173,0.08)' }
          } else if (m.status === 'active' && holes.length > 0) {
            if (standing.leader === 'A')      { standColor = TEAM_A; standBg = 'rgba(155,181,201,0.10)' }
            else if (standing.leader === 'B') { standColor = TEAM_B; standBg = 'rgba(217,163,142,0.10)' }
            else                              { standColor = LIVE;   standBg = 'rgba(217,201,168,0.10)' }
          }

          let displayLabel
          if (m.status === 'finished') {
            displayLabel = m.winner === 'halved' ? 'A/S' : standing.label
          } else if (m.status === 'active' && holes.length > 0) {
            displayLabel = standing.leader === 'none' ? 'A/S' : standing.label
          } else {
            displayLabel = '—'
          }

          const holeText = m.status === 'finished' ? 'FIN'
            : m.status === 'active' ? `Loch ${holes.length}`
            : 'Offen'

          return (
            <button
              key={m.id}
              onClick={() => navigate(`/matches/${m.id}`)}
              className="w-full text-left active:scale-[0.99] transition-transform"
              style={{
                borderBottom: idx < matches.length - 1 ? '1px solid #15302A' : 'none',
                animationDelay: `${idx * 35}ms`,
              }}
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-inkMuted flex items-center gap-1.5">
                  {typeLbl}
                  {hasFactor && (
                    <span className="text-[9px] font-bold uppercase text-accent bg-accent/10 border border-accent/25 px-1 py-0.5 rounded tabular-nums">
                      ×{Number(m.team_a_factor).toFixed(2)}/{Number(m.team_b_factor).toFixed(2)}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  {m.status === 'active' && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-accent" />
                  )}
                  <span className={`text-[10px] font-bold tracking-wider uppercase tabular-nums ${
                    m.status === 'active' ? 'text-accent' : 'text-inkMuted'
                  }`}>
                    {holeText}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 pb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: TEAM_A }}>
                    {playersA || '—'}
                  </p>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(155,181,201,0.55)' }}>
                    {tournament.team_a_name}
                  </p>
                </div>

                <div
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl tabular-nums"
                  style={{ background: standBg, minWidth: 60, textAlign: 'center' }}
                >
                  <p className="font-condensed font-black text-xl leading-none" style={{ color: standColor }}>
                    {displayLabel}
                  </p>
                </div>

                <div className="flex-1 min-w-0 text-right">
                  <p className="font-semibold text-sm truncate" style={{ color: TEAM_B }}>
                    {playersB || '—'}
                  </p>
                  <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(217,163,142,0.55)' }}>
                    {tournament.team_b_name}
                  </p>
                </div>
              </div>
            </button>
          )
        })}

        {matches.length === 0 && (
          <div className="text-center py-10 px-6">
            <p className="text-sm text-inkMuted">Noch keine Matches</p>
            <p className="text-xs mt-1 text-inkDim">Lege Matches unter <span className="text-accent">Matches</span> an</p>
          </div>
        )}
      </div>

      <div className="h-6" />

      {showViewGate && tournament && (
        <PasswordGate
          viewMode
          tournamentId={tournament.id}
          onSuccess={handleViewGateSuccess}
          onCancel={() => setShowViewGate(false)}
        />
      )}
    </div>
  )
}
