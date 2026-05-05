import { useEffect, useState, useMemo } from 'react'
import { supabase, hasSupabase } from '../lib/supabase'
import { demoTournaments, demoPlayers, demoMatches, demoHoles } from '../lib/demoData'
import { holeOutcome, matchStatus, matchFinished } from './../lib/scoring'

// In-memory store for demo mode — persists across page navigations.
const memory = {
  tournaments: [...demoTournaments],
  players: [...demoPlayers],
  matches: [...demoMatches],
  holes: [...demoHoles],
  listeners: new Set(),
}

function emit() { memory.listeners.forEach(fn => fn()) }
function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 10)}` }

function useDemoSnapshot() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(t => t + 1)
    memory.listeners.add(fn)
    return () => memory.listeners.delete(fn)
  }, [])
  return memory
}

/* ------------------------------------------------------------ Tournaments */
export function useTournaments() {
  const [rows, setRows] = useState(hasSupabase ? null : memory.tournaments)
  const [loading, setLoading] = useState(hasSupabase)
  const snap = useDemoSnapshot()

  useEffect(() => {
    if (!hasSupabase) {
      setRows([...snap.tournaments])
      return
    }
    let active = true
    setLoading(true)
    supabase.from('tournaments').select('*').order('date', { ascending: false }).then(({ data }) => {
      if (active) { setRows(data ?? []); setLoading(false) }
    })
    const ch = supabase.channel('tournaments').on('postgres_changes',
      { event: '*', schema: 'public', table: 'tournaments' },
      () => supabase.from('tournaments').select('*').order('date', { ascending: false }).then(({ data }) => setRows(data ?? []))
    ).subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [snap.tournaments])

  return { tournaments: rows ?? [], loading }
}

export async function createTournament({ name, date, team_a_name, team_b_name }) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('tournaments').insert({ name, date, team_a_name, team_b_name }).select().single()
    if (error) throw error
    return data
  }
  const t = { id: uid('t'), name, date, status: 'active', team_a_name, team_b_name }
  memory.tournaments = [t, ...memory.tournaments]
  emit()
  return t
}

/* ------------------------------------------------------------ Tournament detail */
export function useTournament(id) {
  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const snap = useDemoSnapshot()

  useEffect(() => {
    if (!id) return
    if (!hasSupabase) {
      setTournament(snap.tournaments.find(t => t.id === id) ?? null)
      setPlayers(snap.players.filter(p => p.tournament_id === id))
      setMatches(snap.matches.filter(m => m.tournament_id === id))
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('tournament_id', id),
      supabase.from('matches').select('*').eq('tournament_id', id),
    ]).then(([t, p, m]) => {
      if (!active) return
      setTournament(t.data ?? null)
      setPlayers(p.data ?? [])
      setMatches(m.data ?? [])
      setLoading(false)
    })
    const ch = supabase.channel(`tournament:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` },
        () => supabase.from('matches').select('*').eq('tournament_id', id).then(({ data }) => setMatches(data ?? [])))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `tournament_id=eq.${id}` },
        () => supabase.from('players').select('*').eq('tournament_id', id).then(({ data }) => setPlayers(data ?? [])))
      .subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [id, snap.tournaments, snap.players, snap.matches])

  return { tournament, players, matches, loading }
}

/* ------------------------------------------------------------ Match scoring */
export function useMatch(matchId) {
  const [match, setMatch] = useState(null)
  const [holes, setHoles] = useState([])
  const [loading, setLoading] = useState(true)
  const snap = useDemoSnapshot()

  useEffect(() => {
    if (!matchId) return
    if (!hasSupabase) {
      setMatch(snap.matches.find(m => m.id === matchId) ?? null)
      setHoles(snap.holes.filter(h => h.match_id === matchId).sort((a, b) => a.hole_number - b.hole_number))
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('hole_results').select('*').eq('match_id', matchId).order('hole_number'),
    ]).then(([m, h]) => {
      if (!active) return
      setMatch(m.data ?? null)
      setHoles(h.data ?? [])
      setLoading(false)
    })
    const ch = supabase.channel(`match:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_results', filter: `match_id=eq.${matchId}` },
        () => supabase.from('hole_results').select('*').eq('match_id', matchId).order('hole_number').then(({ data }) => setHoles(data ?? [])))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => supabase.from('matches').select('*').eq('id', matchId).single().then(({ data }) => setMatch(data ?? null)))
      .subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [matchId, snap.matches, snap.holes])

  return { match, holes, loading }
}

export async function saveHole({ match_id, hole_number, strokes_a, strokes_b, stroke_advantage = 'none' }) {
  const winner = holeOutcome(strokes_a, strokes_b, stroke_advantage)
  if (hasSupabase) {
    const { data: existing } = await supabase.from('hole_results').select('id').eq('match_id', match_id).eq('hole_number', hole_number).maybeSingle()
    if (existing) {
      await supabase.from('hole_results').update({ strokes_a, strokes_b, winner, stroke_advantage }).eq('id', existing.id)
    } else {
      await supabase.from('hole_results').insert({ match_id, hole_number, strokes_a, strokes_b, winner, stroke_advantage })
    }
    // update match status if finished
    const { data: holes } = await supabase.from('hole_results').select('winner').eq('match_id', match_id)
    if (matchFinished(holes ?? [])) {
      const ms = matchStatus(holes ?? [])
      await supabase.from('matches').update({ status: 'finished', winner: ms.leader }).eq('id', match_id)
    } else if ((holes?.length ?? 0) > 0) {
      await supabase.from('matches').update({ status: 'active' }).eq('id', match_id)
    }
    return
  }
  // demo
  const idx = memory.holes.findIndex(h => h.match_id === match_id && h.hole_number === hole_number)
  if (idx >= 0) memory.holes[idx] = { ...memory.holes[idx], strokes_a, strokes_b, winner, stroke_advantage }
  else memory.holes = [...memory.holes, { id: uid('h'), match_id, hole_number, strokes_a, strokes_b, winner, stroke_advantage }]

  const matchHoles = memory.holes.filter(h => h.match_id === match_id)
  const m = memory.matches.find(mm => mm.id === match_id)
  if (m) {
    if (matchFinished(matchHoles)) {
      const ms = matchStatus(matchHoles)
      m.status = 'finished'; m.winner = ms.leader
    } else {
      m.status = 'active'; m.winner = null
    }
  }
  emit()
}

export async function addPlayer({ tournament_id, name, handicap, team }) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('players').insert({ tournament_id, name, handicap, team }).select().single()
    if (error) throw error
    return data
  }
  const p = { id: uid('p'), tournament_id, name, handicap, team }
  memory.players = [...memory.players, p]
  emit()
  return p
}

export async function addMatch({ tournament_id, type, team_a_player1_id, team_a_player2_id = null, team_b_player1_id, team_b_player2_id = null }) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('matches').insert({
      tournament_id, type, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id,
    }).select().single()
    if (error) throw error
    return data
  }
  const m = {
    id: uid('m'), tournament_id, type,
    team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id,
    status: 'pending', winner: null,
  }
  memory.matches = [...memory.matches, m]
  emit()
  return m
}

/* ------------------------------------------------------------ All matches (for leaderboard) */
export function useAllMatches() {
  const [rows, setRows] = useState(hasSupabase ? null : memory.matches)
  const snap = useDemoSnapshot()
  useEffect(() => {
    if (!hasSupabase) {
      setRows([...snap.matches])
      return
    }
    let active = true
    supabase.from('matches').select('*').then(({ data }) => { if (active) setRows(data ?? []) })
    const ch = supabase.channel('matches-all').on('postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      () => supabase.from('matches').select('*').then(({ data }) => setRows(data ?? []))
    ).subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [snap.matches])
  return rows ?? []
}

/* ------------------------------------------------------------ helpers */
export function usePlayerLookup(players) {
  return useMemo(() => {
    const map = new Map()
    for (const p of players) map.set(p.id, p)
    return id => (id ? map.get(id) : null)
  }, [players])
}

export function useMatchHolesSummary(holes) {
  return useMemo(() => {
    const status = matchStatus(holes)
    const finished = matchFinished(holes)
    return { ...status, finished, played: holes.length, remaining: 18 - holes.length }
  }, [holes])
}

