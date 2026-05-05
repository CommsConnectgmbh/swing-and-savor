// Demo data used when Supabase env vars are not configured.
// Lets the UI shine without backend.

export const demoTournaments = [
  {
    id: 't1',
    name: 'Ryder Cup Stuttgart',
    date: '2026-05-18',
    status: 'active',
    team_a_name: 'Eagles',
    team_b_name: 'Birdies',
  },
  {
    id: 't2',
    name: 'Sommer-Cup München',
    date: '2026-07-04',
    status: 'active',
    team_a_name: 'North',
    team_b_name: 'South',
  },
  {
    id: 't3',
    name: 'Winter Klassik 2025',
    date: '2025-12-12',
    status: 'finished',
    team_a_name: 'Reds',
    team_b_name: 'Blues',
  },
]

export const demoPlayers = [
  { id: 'p1', tournament_id: 't1', name: 'Lukas Berger',  handicap: 8.4,  team: 'A' },
  { id: 'p2', tournament_id: 't1', name: 'Max Hoffmann',  handicap: 12.1, team: 'A' },
  { id: 'p3', tournament_id: 't1', name: 'Nina Roth',     handicap: 6.2,  team: 'A' },
  { id: 'p4', tournament_id: 't1', name: 'Tom Vogel',     handicap: 10.0, team: 'A' },
  { id: 'p5', tournament_id: 't1', name: 'Sven Klein',    handicap: 9.5,  team: 'B' },
  { id: 'p6', tournament_id: 't1', name: 'Julia Maier',   handicap: 11.8, team: 'B' },
  { id: 'p7', tournament_id: 't1', name: 'Felix Wagner',  handicap: 7.3,  team: 'B' },
  { id: 'p8', tournament_id: 't1', name: 'Ana Lopez',     handicap: 13.5, team: 'B' },
]

export const demoMatches = [
  {
    id: 'm1', tournament_id: 't1', type: 'singles',
    team_a_player1_id: 'p1', team_a_player2_id: null,
    team_b_player1_id: 'p5', team_b_player2_id: null,
    status: 'active', winner: null,
  },
  {
    id: 'm2', tournament_id: 't1', type: 'singles',
    team_a_player1_id: 'p3', team_a_player2_id: null,
    team_b_player1_id: 'p7', team_b_player2_id: null,
    status: 'finished', winner: 'A',
  },
  {
    id: 'm3', tournament_id: 't1', type: 'doubles',
    team_a_player1_id: 'p2', team_a_player2_id: 'p4',
    team_b_player1_id: 'p6', team_b_player2_id: 'p8',
    status: 'pending', winner: null,
  },
]

export const demoHoles = [
  { id: 'h1', match_id: 'm1', hole_number: 1, strokes_a: 4, strokes_b: 5, winner: 'A', stroke_advantage: 'none' },
  { id: 'h2', match_id: 'm1', hole_number: 2, strokes_a: 5, strokes_b: 5, winner: 'halved', stroke_advantage: 'none' },
  { id: 'h3', match_id: 'm1', hole_number: 3, strokes_a: 3, strokes_b: 4, winner: 'A', stroke_advantage: 'none' },
  { id: 'h4', match_id: 'm1', hole_number: 4, strokes_a: 6, strokes_b: 5, winner: 'B', stroke_advantage: 'none' },
  { id: 'h5', match_id: 'm1', hole_number: 5, strokes_a: 4, strokes_b: 4, winner: 'halved', stroke_advantage: 'none' },
  { id: 'h6', match_id: 'm2', hole_number: 1, strokes_a: 4, strokes_b: 5, winner: 'A', stroke_advantage: 'none' },
  { id: 'h7', match_id: 'm2', hole_number: 2, strokes_a: 4, strokes_b: 5, winner: 'A', stroke_advantage: 'none' },
]
