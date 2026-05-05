import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Stepper } from '../components/Stepper'
import { useMatch, useTournament, usePlayerLookup, saveHole, useMatchHolesSummary } from '../hooks/useGolfData'
import { holeOutcome } from '../lib/scoring'

function HoleDots({ holes, current }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 py-2">
      {Array.from({ length: 18 }).map((_, i) => {
        const num = i + 1
        const h = holes.find(x => x.hole_number === num)
        const isCurrent = num === current
        let cls = 'bg-white/8 text-muted'
        if (h?.winner === 'A') cls = 'bg-teamA/30 text-teamA ring-1 ring-teamA/40'
        else if (h?.winner === 'B') cls = 'bg-teamB/30 text-teamB ring-1 ring-teamB/40'
        else if (h?.winner === 'halved') cls = 'bg-white/15 text-ink'
        return (
          <div key={num}
               className={`shrink-0 w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center ${cls} ${isCurrent ? 'outline outline-2 outline-fairway scale-110' : ''} transition`}
          >
            {num}
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ summary, teamAName, teamBName }) {
  let label, tone
  if (summary.played === 0) { label = 'Bereit'; tone = 'text-muted bg-white/5' }
  else if (summary.value === 0) { label = 'AS · All Square'; tone = 'text-ink bg-white/10' }
  else {
    label = `${summary.lead} · ${summary.leader === 'A' ? teamAName : teamBName}`
    tone = summary.leader === 'A' ? 'text-teamA bg-teamA/15 ring-1 ring-teamA/30' : 'text-teamB bg-teamB/15 ring-1 ring-teamB/30'
  }
  return (
    <div className={`chip ${tone} font-semibold`}>
      <Icon.Pin size={14} stroke={2.2} /> {label}
    </div>
  )
}

export default function MatchScoring() {
  const { tournamentId, matchId } = useParams()
  const { match, holes, loading } = useMatch(matchId)
  const { tournament, players } = useTournament(tournamentId)
  const lookup = usePlayerLookup(players)
  const summary = useMatchHolesSummary(holes)

  const firstUnplayed = useMemo(() => {
    for (let n = 1; n <= 18; n++) if (!holes.some(h => h.hole_number === n)) return n
    return 18
  }, [holes])

  const [current, setCurrent] = useState(firstUnplayed)
  useEffect(() => { setCurrent(firstUnplayed) }, [firstUnplayed])

  const existing = holes.find(h => h.hole_number === current)
  const [strokesA, setStrokesA] = useState(existing?.strokes_a ?? 4)
  const [strokesB, setStrokesB] = useState(existing?.strokes_b ?? 4)
  const [adv, setAdv] = useState(existing?.stroke_advantage ?? 'none')
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(0)

  useEffect(() => {
    setStrokesA(existing?.strokes_a ?? 4)
    setStrokesB(existing?.strokes_b ?? 4)
    setAdv(existing?.stroke_advantage ?? 'none')
  }, [current, existing?.id])

  if (loading || !match || !tournament) {
    return <div className="px-4 pb-safe space-y-3 mt-4">{[0,1,2].map(i => <div key={i} className="h-32 rounded-3xl shimmer" />)}</div>
  }

  const a1 = lookup(match.team_a_player1_id)
  const a2 = lookup(match.team_a_player2_id)
  const b1 = lookup(match.team_b_player1_id)
  const b2 = lookup(match.team_b_player2_id)

  const provisional = holeOutcome(strokesA, strokesB, adv)

  const persistAndAdvance = async (advance = true) => {
    setSaving(true)
    try {
      await saveHole({ match_id: matchId, hole_number: current, strokes_a: strokesA, strokes_b: strokesB, stroke_advantage: adv })
      setSavedTick(t => t + 1)
      if (advance && current < 18) setCurrent(c => c + 1)
    } finally { setSaving(false) }
  }

  return (
    <div className="px-4 pb-safe">
      <Header
        title={`Loch ${current}`}
        subtitle={`${match.type === 'singles' ? 'Einzel' : 'Doppel'} · ${tournament.name}`}
        back
        right={<StatusPill summary={summary} teamAName={tournament.team_a_name} teamBName={tournament.team_b_name} />}
      />

      <main className="space-y-4 mt-1">
        {/* Players header */}
        <div className="card">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex -space-x-2">{a1 && <Avatar name={a1.name} team="A" />}{a2 && <Avatar name={a2.name} team="A" />}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{a1?.name}{a2 ? ` & ${a2.name}` : ''}</div>
                <div className="text-[11px] text-muted truncate">{tournament.team_a_name}</div>
              </div>
            </div>
            <div className="text-muted text-xs font-semibold">vs</div>
            <div className="flex items-center gap-2 min-w-0 justify-end text-right">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{b1?.name}{b2 ? ` & ${b2.name}` : ''}</div>
                <div className="text-[11px] text-muted truncate">{tournament.team_b_name}</div>
              </div>
              <div className="flex -space-x-2">{b1 && <Avatar name={b1.name} team="B" />}{b2 && <Avatar name={b2.name} team="B" />}</div>
            </div>
          </div>
          <HoleDots holes={holes} current={current} />
        </div>

        {/* Steppers */}
        <div className="grid grid-cols-2 gap-3">
          <Stepper label={tournament.team_a_name} accent="A" value={strokesA} onChange={setStrokesA} />
          <Stepper label={tournament.team_b_name} accent="B" value={strokesB} onChange={setStrokesB} />
        </div>

        {/* Stroke advantage selector */}
        <div className="card">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2 font-semibold">Vorgabe-Schlag (Stroke)</div>
          <div className="pill rounded-full p-1 grid grid-cols-3 gap-1">
            {[
              ['A',    `+1 ${tournament.team_a_name}`, 'text-teamA'],
              ['none', 'Kein',                          'text-ink/80'],
              ['B',    `+1 ${tournament.team_b_name}`, 'text-teamB'],
            ].map(([k, l, c]) => (
              <button key={k} onClick={() => setAdv(k)}
                className={`py-2 rounded-full text-xs font-medium tap truncate ${adv === k ? `bg-white/15 ${c}` : 'text-muted'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Outcome preview */}
        <div className="card flex items-center gap-3">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold flex-1">Ergebnis Loch {current}</div>
          {provisional === 'A' && <div className="chip text-teamA bg-teamA/15 ring-1 ring-teamA/30 font-semibold">{tournament.team_a_name} gewinnt</div>}
          {provisional === 'B' && <div className="chip text-teamB bg-teamB/15 ring-1 ring-teamB/30 font-semibold">{tournament.team_b_name} gewinnt</div>}
          {provisional === 'halved' && <div className="chip text-ink bg-white/10 font-semibold">Halved</div>}
        </div>

        {/* Save / nav */}
        <div className="flex gap-2 sticky bottom-24">
          <button
            onClick={() => setCurrent(c => Math.max(1, c - 1))}
            disabled={current <= 1}
            className="btn-glass disabled:opacity-40 px-4"
            aria-label="Vorheriges Loch"
          >
            <Icon.ChevronLeft />
          </button>
          <button
            onClick={() => persistAndAdvance(true)}
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? 'Speichert…' : current >= 18 ? <><Icon.Check size={18} /> Speichern</> : <><Icon.Check size={18} /> Speichern · Loch {current + 1}</>}
          </button>
          <button
            onClick={() => setCurrent(c => Math.min(18, c + 1))}
            disabled={current >= 18}
            className="btn-glass disabled:opacity-40 px-4"
            aria-label="Nächstes Loch"
          >
            <Icon.ChevronRight />
          </button>
        </div>

        {savedTick > 0 && (
          <div key={savedTick} className="fixed top-20 inset-x-0 mx-auto w-fit z-40 chip text-fairway bg-fairway/15 ring-1 ring-fairway/40 font-semibold animate-pop">
            <Icon.Check size={14} stroke={2.4} /> Gespeichert
          </div>
        )}
      </main>
    </div>
  )
}
