import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcMatchStanding } from '../lib/scoring'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MatchDetailScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [holeResults, setHoleResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHoleForm, setShowHoleForm] = useState(false)
  const [deleteHoleId, setDeleteHoleId] = useState(null)
  const [holeForm, setHoleForm] = useState({ strokes_a: '', strokes_b: '', stroke_advantage: 'none' })

  useEffect(() => { loadAll() }, [matchId])

  async function loadAll() {
    const [{ data: m }, { data: h }] = await Promise.all([
      supabase.from('matches').select(`
        *,
        pa1:team_a_player1_id(name, handicap),
        pa2:team_a_player2_id(name, handicap),
        pb1:team_b_player1_id(name, handicap),
        pb2:team_b_player2_id(name, handicap),
        tournament:tournament_id(team_a_name, team_b_name)
      `).eq('id', matchId).single(),
      supabase.from('hole_results').select('*').eq('match_id', matchId).order('hole_number'),
    ])
    setMatch(m)
    setHoleResults(h || [])
    setLoading(false)
  }

  const nextHole = holeResults.length + 1
  const standing = calcMatchStanding(holeResults)
  const canAddHole = nextHole <= 18 && match?.status !== 'finished'

  async function handleAddHole(e) {
    e.preventDefault()
    const sa = parseInt(holeForm.strokes_a)
    const sb = parseInt(holeForm.strokes_b)
    if (!sa || !sb || sa < 1 || sb < 1) return
    const winner = sa < sb ? 'A' : sb < sa ? 'B' : 'halved'
    await supabase.from('hole_results').insert([{
      match_id: matchId,
      hole_number: nextHole,
      strokes_a: sa,
      strokes_b: sb,
      winner,
      stroke_advantage: holeForm.stroke_advantage,
    }])
    await supabase.from('matches').update({ status: 'active' }).eq('id', matchId)
    setHoleForm({ strokes_a: '', strokes_b: '', stroke_advantage: 'none' })
    setShowHoleForm(false)
    loadAll()
  }

  async function handleFinishMatch() {
    const winner = standing.leader !== 'none' ? standing.leader : 'halved'
    await supabase.from('matches').update({ status: 'finished', winner }).eq('id', matchId)
    loadAll()
  }

  async function handleDeleteHole() {
    await supabase.from('hole_results').delete().eq('id', deleteHoleId)
    await supabase.from('matches').update({
      status: holeResults.length <= 1 ? 'pending' : 'active',
      winner: null
    }).eq('id', matchId)
    setDeleteHoleId(null)
    loadAll()
  }

  if (loading) return <div className="p-4 pt-8"><LoadingSpinner /></div>
  if (!match) return <div className="p-4 pt-8 text-muted">Match nicht gefunden</div>

  const teamA = [match.pa1?.name, match.pa2?.name].filter(Boolean).join(' / ')
  const teamB = [match.pb1?.name, match.pb2?.name].filter(Boolean).join(' / ')
  const tA = match.tournament?.team_a_name
  const tB = match.tournament?.team_b_name

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-muted text-2xl leading-none">‹</button>
        <div>
          <div className="text-xs text-muted">{match.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</div>
          <div className="font-bold">{teamA} vs {teamB}</div>
        </div>
      </div>

      {/* Standing */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6 text-center">
        <div className={`text-4xl font-black mb-1 ` +
          (standing.leader === 'A' ? 'text-accent' : standing.leader === 'B' ? 'text-danger' : 'text-white')}>
          {standing.label}
        </div>
        {standing.leader !== 'none' && (
          <div className="text-muted text-sm">{standing.leader === 'A' ? tA : tB} führt</div>
        )}
        <div className="text-muted text-xs mt-1">
          {holeResults.length === 0 ? 'Noch kein Loch gespielt' : `Nach Loch ${holeResults.length}`}
        </div>
        {match.status === 'finished' && <div className="mt-2 text-accent font-bold text-sm">MATCH BEENDET</div>}
      </div>

      {/* Hole table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-5 text-xs text-muted uppercase tracking-widest px-4 py-2 border-b border-border">
          <span>Loch</span>
          <span className="text-center">{tA?.substring(0,6)}</span>
          <span className="text-center">{tB?.substring(0,6)}</span>
          <span className="text-center">Vorg.</span>
          <span className="text-center">Erg.</span>
        </div>
        {holeResults.map(h => (
          <div key={h.id}
            className="grid grid-cols-5 px-4 py-3 border-b border-border last:border-0 items-center active:bg-border/20"
            onClick={() => setDeleteHoleId(h.id)}>
            <span className="font-mono font-bold text-accent">{h.hole_number}</span>
            <span className={`text-center font-mono ` + (h.winner === 'A' ? 'text-accent font-bold' : 'text-white')}>{h.strokes_a}</span>
            <span className={`text-center font-mono ` + (h.winner === 'B' ? 'text-danger font-bold' : 'text-white')}>{h.strokes_b}</span>
            <span className="text-center text-xs text-muted">{h.stroke_advantage === 'none' ? '—' : h.stroke_advantage}</span>
            <span className={`text-center text-xs font-medium ` +
              (h.winner === 'A' ? 'text-accent' : h.winner === 'B' ? 'text-danger' : 'text-muted')}>
              {h.winner === 'A' ? 'A' : h.winner === 'B' ? 'B' : '½'}
            </span>
          </div>
        ))}
        {holeResults.length === 0 && <div className="text-muted text-sm text-center py-6">Noch keine Löcher eingetragen</div>}
      </div>
      {holeResults.length > 0 && <p className="text-muted text-xs text-center mb-4">Loch antippen zum Löschen</p>}

      {/* Add hole */}
      {canAddHole && (
        showHoleForm ? (
          <form onSubmit={handleAddHole} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
            <div className="text-sm font-medium text-accent">Loch {nextHole}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">{tA} – Schläge</label>
                <input type="number" min="1" max="20"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
                  placeholder="—" value={holeForm.strokes_a}
                  onChange={e => setHoleForm(f => ({ ...f, strokes_a: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">{tB} – Schläge</label>
                <input type="number" min="1" max="20"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
                  placeholder="—" value={holeForm.strokes_b}
                  onChange={e => setHoleForm(f => ({ ...f, strokes_b: e.target.value }))} required />
              </div>
            </div>
            <select className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white"
              value={holeForm.stroke_advantage}
              onChange={e => setHoleForm(f => ({ ...f, stroke_advantage: e.target.value }))}>
              <option value="none">Keine Vorgabe</option>
              <option value="A">{tA} bekommt Vorgabe</option>
              <option value="B">{tB} bekommt Vorgabe</option>
            </select>
            <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">
              Loch {nextHole} speichern
            </button>
            <button type="button" onClick={() => setShowHoleForm(false)} className="text-muted text-sm text-center py-1">Abbrechen</button>
          </form>
        ) : (
          <button onClick={() => setShowHoleForm(true)}
            className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-lg mb-3">
            + Loch {nextHole} eintragen
          </button>
        )
      )}

      {holeResults.length > 0 && match.status === 'active' && (
        <button onClick={handleFinishMatch}
          className="w-full border border-accent text-accent font-bold py-4 rounded-2xl text-lg">
          Match beenden
        </button>
      )}

      {deleteHoleId && (
        <ConfirmDialog
          message="Loch-Ergebnis wirklich löschen?"
          onConfirm={handleDeleteHole}
          onCancel={() => setDeleteHoleId(null)}
        />
      )}
    </div>
  )
}
