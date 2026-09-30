import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'
import CourseEditor from '../components/CourseEditor'
import CoursePicker from '../components/CoursePicker'
import SocialBar from '../components/SocialBar'
import CommentsThread from '../components/CommentsThread'
import { applyCourseEdit } from '../lib/courses'
import { uploadMatchPhoto, clearMatchPhoto } from '../lib/photo'
import { fetchSocialCounts, fetchMyReactions } from '../lib/social'
import { renderMatchShareCard, shareOrDownload } from '../lib/shareCard'
import { calcStablefordTotals, stablefordPoints, calcMatchPlayStatus, matchPlayHoleRun } from '../lib/scoring'
import HoleByHoleTable from '../components/HoleByHoleTable'
import { fmtPts, formatCupDate } from '../lib/format'
import { isUnlocked } from '../lib/tournamentGate'
import { pushToast } from '../lib/toast'
import { readLocalJson, writeLocalJson, removeLocal } from '../lib/storage'
import { useAuth } from '../lib/auth'
import WinnerCardSheet from '../components/WinnerCardSheet'
import ScorecardSheet from '../components/ScorecardSheet'
import {
  publishMatchToWatch,
  clearWatchMatch,
  onWatchScore,
  onWatchRefreshRequest,
  buildWatchPayload,
} from '../lib/watchBridge'

const TEAM_A = '#9BB5C9'
const TEAM_B = '#D9A38E'

function initHoles() {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: 4, strokes_a: '', strokes_b: '', winner: null,
  }))
}

function calcWinner(sa, sb) {
  const a = parseInt(sa, 10), b = parseInt(sb, 10)
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return null
  if (a < b) return 'A'
  if (b < a) return 'B'
  return 'halved'
}

function fmtDelta(v) {
  if (v === null) return null
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : String(v)
}

function ResultDot({ winner }) {
  if (!winner) {
    return <div className="w-9 h-9 rounded-full border border-line" />
  }
  if (winner === 'A') {
    return <div className="w-9 h-9 rounded-full" style={{ background: TEAM_A }} />
  }
  if (winner === 'halved') {
    return (
      <div className="w-9 h-9 rounded-full bg-warn flex items-center justify-center">
        <span className="text-brandDark font-black text-sm leading-none">½</span>
      </div>
    )
  }
  return <div className="w-9 h-9 rounded-full" style={{ background: TEAM_B }} />
}

function StablefordPill({ a, b }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[10px] font-black tabular-nums leading-none">
      <span style={{ color: TEAM_A }}>{a ?? '–'}</span>
      <span style={{ color: TEAM_B }}>{b ?? '–'}</span>
    </div>
  )
}

export default function MatchDetailScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [match, setMatch] = useState(null)
  const [socialCount, setSocialCount] = useState({ likes: 0, comments: 0 })
  const [iLiked, setILiked] = useState(false)
  const [holes, setHoles] = useState(initHoles)
  const [loading, setLoading] = useState(true)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [showViewGate, setShowViewGate] = useState(false)
  const [viewGateTournamentId, setViewGateTournamentId] = useState(null)
  const [course, setCourse] = useState(null)
  const [showCourseEditor, setShowCourseEditor] = useState(false)
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [flightNames, setFlightNames] = useState({ A: [], B: [] })
  const [flightPlayers, setFlightPlayers] = useState([])
  const [scorecardOpen, setScorecardOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const photoInputRef = useRef(null)
  const matchRef = useRef(null)
  const holesRef = useRef(holes)
  const flightNamesRef = useRef(flightNames)
  const courseRef = useRef(null)
  const channelRef = useRef(null)
  const loadTokenRef = useRef(0)

  useEffect(() => { holesRef.current = holes }, [holes])
  useEffect(() => { flightNamesRef.current = flightNames }, [flightNames])
  useEffect(() => { courseRef.current = course }, [course])

  useEffect(() => {
    init()
    return () => {
      // Invalidate in-flight loads and tear down realtime on match switch/unmount.
      loadTokenRef.current++
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // ── gate-first init: prüft Sicht-Schutz BEVOR Match/Holes geladen werden ──
  async function init() {
    const token = ++loadTokenRef.current
    setLoading(true)
    setShowViewGate(false)
    // Minimaler Vorab-Fetch: nur Schutz-Flag, keine Score-/Spielerdaten.
    const { data: meta } = await supabase
      .from('matches')
      .select('id, tournament:tournament_id(id, has_edit_password)')
      .eq('id', matchId).single()
    if (token !== loadTokenRef.current) return
    if (meta?.tournament && !isUnlocked(meta.tournament)) {
      // Daten NICHT laden, bis das Passwort serverseitig geprüft wurde.
      setViewGateTournamentId(meta.tournament.id)
      setShowViewGate(true)
      setLoading(false)
      return
    }
    await loadAll(token)
  }

  // Apple Watch sync — mirror this match to the paired watch.
  async function applyHoleFromWatch(holeNum, sa, sb) {
    if (!Number.isInteger(holeNum) || sa < 1 || sb < 1) return
    setHoles(prev => {
      const next = prev.map(h =>
        h.hole_number === holeNum
          ? { ...h, strokes_a: String(sa), strokes_b: String(sb), winner: calcWinner(String(sa), String(sb)) }
          : h
      )
      holesRef.current = next
      return next
    })
    try {
      await supabase.from('hole_results').upsert(
        [{
          match_id: matchId, hole_number: holeNum,
          strokes_a: sa, strokes_b: sb,
          winner: calcWinner(String(sa), String(sb)),
          stroke_advantage: 'none',
        }],
        { onConflict: 'match_id,hole_number' }
      )
      if (matchRef.current?.status === 'pending') {
        await supabase.from('matches').update({ status: 'active' }).eq('id', matchId)
        const upd = { ...matchRef.current, status: 'active' }
        matchRef.current = upd
        setMatch(upd)
      }
    } catch (e) {
      console.warn('[watch] apply failed', e)
    }
  }

  function pushToWatch() {
    const m = matchRef.current
    if (!m) return
    const fn = flightNamesRef.current || { A: [], B: [] }
    const namesA = fn.A?.length ? fn.A : [m.pa1?.name, m.pa2?.name].filter(Boolean)
    const namesB = fn.B?.length ? fn.B : [m.pb1?.name, m.pb2?.name].filter(Boolean)
    const baseTypeLbl = m.type === 'singles' ? 'Singles'
      : m.type === 'doubles' ? 'Doubles'
      : `Flight ${namesA.length}v${namesB.length}`
    const typeLabel = m.format === 'stableford' ? `${baseTypeLbl} · Stableford` : baseTypeLbl
    const payload = buildWatchPayload({
      match: m, holes: holesRef.current, tournament: m.tournament,
      course: courseRef.current, namesA, namesB, typeLabel,
    })
    if (payload) publishMatchToWatch(payload)
  }

  useEffect(() => {
    if (!match) return
    pushToWatch()
  }, [match?.id, match?.status, holes])

  useEffect(() => {
    const offScore = onWatchScore((evt) => {
      const holeNum = parseInt(evt?.holeNumber, 10)
      const sa = parseInt(evt?.strokesA, 10)
      const sb = parseInt(evt?.strokesB, 10)
      if (!holeNum || !sa || !sb) return
      if (evt?.matchId && matchRef.current?.id && evt.matchId !== matchRef.current.id) return
      applyHoleFromWatch(holeNum, sa, sb)
    })
    const offRefresh = onWatchRefreshRequest(() => pushToWatch())
    return () => { offScore(); offRefresh(); clearWatchMatch() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  function getPars() {
    return readLocalJson(`par_${matchId}`)
  }
  function setPars(holesArr) {
    writeLocalJson(`par_${matchId}`, holesArr.map(h => h.par))
  }

  async function loadAll(token = loadTokenRef.current) {
    const [{ data: m }, { data: hrs }] = await Promise.all([
      supabase.from('matches').select(`
        *,
        pa1:team_a_player1_id(name),
        pa2:team_a_player2_id(name),
        pb1:team_b_player1_id(name),
        pb2:team_b_player2_id(name),
        tournament:tournament_id(id, team_a_name, team_b_name, name, date, owner_id, has_edit_password),
        course:course_id(id, name, city, country, hole_pars, hole_handicaps, total_par, contributor_count)
      `).eq('id', matchId).single(),
      supabase.from('hole_results')
        .select('*').eq('match_id', matchId).order('hole_number'),
    ])
    if (token !== loadTokenRef.current) return

    matchRef.current = m
    setMatch(m)
    setCourse(m?.course || null)

    // Bei Flights/Doubles: alle Spielernamen anhand der Arrays nachladen
    const aIds = m?.team_a_player_ids?.length ? m.team_a_player_ids
                 : [m?.team_a_player1_id, m?.team_a_player2_id].filter(Boolean)
    const bIds = m?.team_b_player_ids?.length ? m.team_b_player_ids
                 : [m?.team_b_player1_id, m?.team_b_player2_id].filter(Boolean)
    const allIds = [...aIds, ...bIds]
    if (allIds.length > 0) {
      const { data: pls } = await supabase.from('players')
        .select('id,name,handicap,profile_id,team').in('id', allIds)
      if (token !== loadTokenRef.current) return
      const byId = Object.fromEntries((pls || []).map(p => [p.id, p]))
      setFlightNames({
        A: aIds.map(id => byId[id]?.name).filter(Boolean),
        B: bIds.map(id => byId[id]?.name).filter(Boolean),
      })
      const ordered = [...aIds, ...bIds].map(id => byId[id]).filter(Boolean)
      setFlightPlayers(ordered)
    } else {
      setFlightNames({ A: [], B: [] })
      setFlightPlayers([])
    }

    // Priority: 1) match snapshot, 2) course defaults, 3) localStorage, 4) Par 4 fallback
    const localPars = getPars()
    const matchPars = (m?.hole_pars && m.hole_pars.length === 18) ? m.hole_pars : null
    const coursePars = (m?.course?.hole_pars && m.course.hole_pars.length === 18) ? m.course.hole_pars : null
    const sourcePars = matchPars || coursePars || localPars

    // Verlässt sich eine DB-Quelle auf Pars, ist der lokale Cache obsolet →
    // invalidieren, damit er nach Course-Wechsel nicht stale weiterlebt.
    if (matchPars || coursePars) {
      removeLocal(`par_${matchId}`)
    }

    const next = initHoles()
    if (sourcePars) sourcePars.forEach((p, i) => { if (p) next[i].par = p })
    if (hrs) {
      hrs.forEach(hr => {
        const i = hr.hole_number - 1
        if (i >= 0 && i < 18) {
          next[i] = {
            ...next[i],
            strokes_a: String(hr.strokes_a),
            strokes_b: String(hr.strokes_b),
            winner: hr.winner,
          }
        }
      })
    }
    setHoles(next)
    setLoading(false)

    subscribeRealtime(token)

    // Social-Counts laden
    const [counts, mine] = await Promise.all([
      fetchSocialCounts([matchId]),
      user?.id ? fetchMyReactions([matchId], user.id) : Promise.resolve(new Set()),
    ])
    if (token !== loadTokenRef.current) return
    setSocialCount(counts[matchId] || { likes: 0, comments: 0 })
    setILiked(mine.has(matchId))
  }

  // ── Live-Scoring: match-gescopte Realtime-Subscription ──────────────────────
  // Server-Filter (match_id / id) statt globaler Stream. Eingehende Holes werden
  // gemergt; lokal noch unbestätigte Tipp-Eingaben werden NICHT überschrieben.
  function subscribeRealtime(token) {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const ch = supabase.channel(`match-${matchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hole_results', filter: `match_id=eq.${matchId}` },
        ({ new: hr }) => {
          if (token !== loadTokenRef.current || !hr?.hole_number) return
          mergeRemoteHole(hr)
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        ({ new: m }) => {
          if (token !== loadTokenRef.current || !m) return
          const merged = { ...(matchRef.current || {}), status: m.status, winner: m.winner }
          matchRef.current = merged
          setMatch(merged)
        })
      .subscribe()
    channelRef.current = ch
  }

  function mergeRemoteHole(hr) {
    const i = hr.hole_number
    setHoles(prev => prev.map(h => {
      if (h.hole_number !== i) return h
      // Lokale Eingabe (ein Feld gefüllt, Loch noch nicht persistiert) schützen:
      // nur übernehmen, wenn lokal noch nichts Abweichendes getippt wurde.
      const localTyped = (h.strokes_a !== '' && h.strokes_a !== String(hr.strokes_a))
                      || (h.strokes_b !== '' && h.strokes_b !== String(hr.strokes_b))
      if (localTyped) return h
      return { ...h, strokes_a: String(hr.strokes_a), strokes_b: String(hr.strokes_b), winner: hr.winner }
    }))
  }

  async function handleShare() {
    if (!match) return
    try {
      const namesA = flightNames.A.length ? flightNames.A : [match.pa1?.name, match.pa2?.name].filter(Boolean)
      const namesB = flightNames.B.length ? flightNames.B : [match.pb1?.name, match.pb2?.name].filter(Boolean)
      const typeStr = match.type === 'singles' ? 'Singles'
                     : match.type === 'doubles' ? 'Doubles'
                     : `Flight ${namesA.length}v${namesB.length}`
      const scoreLine = match.status === 'finished'
        ? (match.winner === 'A' ? (match.tournament?.team_a_name || 'TEAM A')
          : match.winner === 'B' ? (match.tournament?.team_b_name || 'TEAM B')
          : 'A/S')
        : `${ptsA} : ${ptsB}`
      const statusLabel = match.status === 'finished' ? 'Beendet'
                         : match.status === 'active'  ? `Live · Loch ${played.length}`
                         : 'Offen'
      const { blob } = await renderMatchShareCard({
        type: typeStr, namesA, namesB,
        teamANameLabel: match.tournament?.team_a_name,
        teamBNameLabel: match.tournament?.team_b_name,
        scoreLine, statusLabel,
        courseName: match.course?.name,
        cupName: match.tournament?.name,
      })
      await shareOrDownload({
        blob, filename: `swingandsavor-${matchId.slice(0, 8)}.png`,
        title: 'Swing & Savor', text: 'Schau das Match!',
        url: `https://app.swingandsavor.at/matches/${matchId}`,
      })
    } catch (e) { console.error('[match] share', e) }
  }

  // When user picks/changes the course for this match
  async function pickCourse(c) {
    if (!c) return
    setCourse(c)
    // Update match record (snapshot pars + handicaps)
    const { error } = await supabase.from('matches').update({
      course_id: c.id,
      hole_pars: c.hole_pars?.length ? c.hole_pars : [],
      hole_handicaps: c.hole_handicaps?.length ? c.hole_handicaps : [],
    }).eq('id', matchId)
    if (error) {
      console.error('[match] pickCourse', error)
      pushToast({ icon: '⚠️', title: 'Platz nicht gespeichert', body: 'Bitte erneut versuchen.' })
      return
    }
    // Re-apply pars in UI if no holes played yet (don't overwrite player data)
    if (c.hole_pars?.length === 18) {
      setHoles(prev => prev.map((h, i) =>
        h.winner === null && !h.strokes_a && !h.strokes_b
          ? { ...h, par: c.hole_pars[i] }
          : h
      ))
    }
  }

  // Save the on-screen pars back to the course (community share)
  async function shareScorecardToCourse() {
    if (!course) return
    const pars = holes.map(h => h.par)
    try {
      const updated = await applyCourseEdit(course.id, pars, course.hole_handicaps || [], matchId)
      setCourse(prev => ({ ...prev, ...updated }))
      const { error } = await supabase.from('matches').update({ hole_pars: pars }).eq('id', matchId)
      if (error) throw error
      pushToast({ icon: '⛳', title: 'Platz aktualisiert', body: 'Pars geteilt.' })
    } catch (e) {
      console.error('[match] share course:', e)
      pushToast({ icon: '⚠️', title: 'Konnte nicht teilen', body: 'Bitte erneut versuchen.' })
    }
  }

  function adjustPar(holeNum, delta) {
    setHoles(prev => {
      const next = prev.map(h =>
        h.hole_number === holeNum
          ? { ...h, par: Math.max(3, Math.min(5, h.par + delta)) }
          : h
      )
      setPars(next)
      return next
    })
  }

  async function handleStroke(holeNum, field, value) {
    const next = holes.map(h => {
      if (h.hole_number !== holeNum) return h
      const updated = { ...h, [field]: value }
      updated.winner = calcWinner(updated.strokes_a, updated.strokes_b)
      return updated
    })
    setHoles(next)

    const hole = next.find(h => h.hole_number === holeNum)
    const sa = parseInt(hole.strokes_a)
    const sb = parseInt(hole.strokes_b)
    if (sa >= 1 && sb >= 1) {
      await supabase.from('hole_results').upsert(
        [{
          match_id: matchId, hole_number: holeNum,
          strokes_a: sa, strokes_b: sb,
          winner: hole.winner, stroke_advantage: 'none',
        }],
        { onConflict: 'match_id,hole_number' }
      )
      if (matchRef.current?.status === 'pending') {
        await supabase.from('matches').update({ status: 'active' }).eq('id', matchId)
        const upd = { ...matchRef.current, status: 'active' }
        matchRef.current = upd
        setMatch(upd)
      }
    }
  }

  async function handleFinish() {
    // Optimistisches UI-Echo. Der maßgebliche winner wird serverseitig aus den
    // hole_results berechnet (Trigger matches_finish_validate_winner) — der hier
    // gesendete Wert wird beim Finish ignoriert/überschrieben.
    let winner
    if (matchRef.current?.format === 'stableford') {
      const { a, b } = calcStablefordTotals(holes)
      winner = a > b ? 'A' : b > a ? 'B' : 'halved'
    } else {
      let a = 0, b = 0
      holes.forEach(h => {
        if (h.winner === 'A') a++
        else if (h.winner === 'B') b++
      })
      winner = a > b ? 'A' : b > a ? 'B' : 'halved'
    }
    await supabase.from('matches').update({ status: 'finished', winner }).eq('id', matchId)
    // Autoritativen, serverseitig korrigierten winner zurücklesen.
    const { data: fresh } = await supabase.from('matches')
      .select('status, winner').eq('id', matchId).single()
    const upd = { ...matchRef.current, status: 'finished', winner: fresh?.winner ?? winner }
    matchRef.current = upd
    setMatch(upd)
    setConfirmFinish(false)
  }

  if (loading) return <LoadingSpinner />

  // View-Gate noch bevor Daten geladen sind: Match steckt hinter Passwort,
  // wir haben bewusst nichts außer der matchId geladen.
  if (showViewGate && !match) {
    return (
      <PasswordGate
        viewMode
        tournamentId={viewGateTournamentId}
        onSuccess={() => { setShowViewGate(false); init() }}
        onCancel={() => { setShowViewGate(false); navigate(-1) }}
      />
    )
  }

  if (!match) return <div className="p-6 text-inkMuted text-sm">Match nicht gefunden</div>

  const tA   = match.tournament?.team_a_name || 'Team A'
  const tB   = match.tournament?.team_b_name || 'Team B'
  const namesA = flightNames.A.length ? flightNames.A
                : [match.pa1?.name, match.pa2?.name].filter(Boolean)
  const namesB = flightNames.B.length ? flightNames.B
                : [match.pb1?.name, match.pb2?.name].filter(Boolean)
  const nameA  = namesA.join(' · ')
  const nameB  = namesB.join(' · ')
  const isFlight     = match.type === 'flight'
  const isStableford = match.format === 'stableford'
  const baseTypeLbl  = match.type === 'singles' ? 'Singles'
                      : match.type === 'doubles' ? 'Doubles'
                      : `Flight ${namesA.length}v${namesB.length}`
  const typeLbl   = isStableford ? `${baseTypeLbl} · Stableford` : baseTypeLbl
  const factorA   = Number(match.team_a_factor ?? 1)
  const factorB   = Number(match.team_b_factor ?? 1)
  const hasFactor = !isStableford && (factorA !== 1 || factorB !== 1)
  const done   = match.status === 'finished'
  const locked = !isUnlocked(match.tournament)

  let ptsA, ptsB
  if (isStableford) {
    const t = calcStablefordTotals(holes)
    ptsA = t.a; ptsB = t.b
  } else {
    let rawA = 0, rawB = 0
    holes.forEach(h => {
      if (h.winner === 'A') rawA++
      else if (h.winner === 'B') rawB++
      else if (h.winner === 'halved') { rawA += 0.5; rawB += 0.5 }
    })
    ptsA = Math.round(rawA * factorA * 100) / 100
    ptsB = Math.round(rawB * factorB * 100) / 100
  }

  const played     = holes.filter(h => h.winner !== null)
  // Lochspiel-Live-Stand (wer führt, um wie viel, Dormie/entschieden) — nur für
  // Match Play sinnvoll, bei Stableford zählen Punkte statt Loch-Vorsprung.
  const mpStatus   = !isStableford ? calcMatchPlayStatus(holes) : null
  const mpLeaderName = mpStatus
    ? (mpStatus.leader === 'A' ? (nameA || tA) : mpStatus.leader === 'B' ? (nameB || tB) : null)
    : null
  const totalPar   = holes.reduce((s, h) => s + h.par, 0)
  const playedPar  = played.reduce((s, h) => s + h.par, 0)
  const totA       = holes.reduce((s, h) => s + (parseInt(h.strokes_a) || 0), 0)
  const totB       = holes.reduce((s, h) => s + (parseInt(h.strokes_b) || 0), 0)
  const dA         = totA > 0 ? totA - playedPar : null
  const dB         = totB > 0 ? totB - playedPar : null

  const COLS = '86px 1fr 1fr 48px'

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setPhotoError('Foto zu groß (max 8 MB)'); return }
    setPhotoBusy(true); setPhotoError(null)
    try {
      const url = await uploadMatchPhoto(matchId, file)
      const upd = { ...matchRef.current, photo_url: url }
      matchRef.current = upd
      setMatch(upd)
    } catch (err) {
      console.error('[match] photo upload', err)
      setPhotoError(err.message || 'Upload fehlgeschlagen')
    } finally {
      setPhotoBusy(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function handlePhotoClear() {
    setPhotoBusy(true); setPhotoError(null)
    try {
      await clearMatchPhoto(matchId)
      const upd = { ...matchRef.current, photo_url: null }
      matchRef.current = upd
      setMatch(upd)
    } finally { setPhotoBusy(false) }
  }

  return (
    <div className="max-w-lg mx-auto pb-44 animate-fade-up">

      {/* ── photo cover (optional) ── */}
      {match.photo_url && (
        <div className="relative mx-3 mt-3 rounded-card overflow-hidden bg-bg" style={{ aspectRatio: '16/9' }}>
          <img src={match.photo_url} alt="" loading="lazy"
            className="w-full h-full object-cover" />
          {!done && !locked && (
            <button onClick={handlePhotoClear}
              className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/55 text-white text-[10px] font-bold tracking-wide active:scale-95 transition-transform">
              Foto entfernen
            </button>
          )}
        </div>
      )}

      {/* ── header ── */}
      <div className="flex items-center px-4 pt-5 pb-4 border-b border-lineSoft">
        <button onClick={() => navigate(-1)}
          className="p-1 -ml-1 flex-shrink-0 text-inkMuted active:scale-90 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-inkMuted">
            {typeLbl}
          </p>
          <p className="font-condensed font-black text-4xl leading-tight mt-0.5 tabular-nums">
            <span style={{ color: ptsA >= ptsB ? '#D9C9A8' : '#9ca3af' }}>{fmtPts(ptsA)}</span>
            <span className="mx-2 text-line">:</span>
            <span style={{ color: ptsB > ptsA ? '#D9C9A8' : '#9ca3af' }}>{fmtPts(ptsB)}</span>
          </p>
          {hasFactor && (
            <p className="text-[10px] font-bold tracking-wide uppercase text-accent mt-1">
              Faktor {factorA.toFixed(2)} / {factorB.toFixed(2)}
            </p>
          )}
        </div>

        {done
          ? <span className="text-[10px] font-bold tracking-wider uppercase text-accent bg-accent/12 border border-accent/30 px-2 py-1 rounded-lg flex-shrink-0">FIN</span>
          : <div className="w-12 flex-shrink-0" />
        }
      </div>

      {/* ── Lochspiel-Live-Stand: wer führt, um wie viele Löcher ── */}
      {mpStatus && (
        mpStatus.holesPlayed === 0 ? (
          <div className="mx-3 mt-3 rounded-card bg-surface border border-line px-4 py-3 text-center">
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-inkMuted">
              Lochspiel · noch kein Loch gespielt
            </span>
          </div>
        ) : (
          <div
            className="mx-3 mt-3 rounded-card border px-4 py-3"
            style={{
              background: mpStatus.leader === 'A' ? 'rgba(155,181,201,0.12)'
                : mpStatus.leader === 'B' ? 'rgba(217,163,142,0.12)'
                : 'rgba(255,255,255,0.03)',
              borderColor: mpStatus.leader === 'A' ? 'rgba(155,181,201,0.45)'
                : mpStatus.leader === 'B' ? 'rgba(217,163,142,0.45)'
                : 'rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted mb-0.5">
                  {done ? 'Endstand' : 'Lochspiel · Live'}
                </p>
                <p className="font-condensed font-black text-xl leading-tight text-ink truncate">
                  {mpStatus.leader === 'none' ? 'Gleichstand' : `${mpLeaderName} führt`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p
                  className="font-condensed font-black text-2xl leading-none tabular-nums"
                  style={{ color: mpStatus.leader === 'A' ? TEAM_A : mpStatus.leader === 'B' ? TEAM_B : '#9ca3af' }}
                >
                  {mpStatus.leader === 'none' ? 'AS' : `${mpStatus.holesUp} auf`}
                </p>
                <p className="text-[10px] font-semibold text-inkDim mt-0.5">
                  {done ? 'beendet'
                    : mpStatus.decided ? 'entschieden'
                    : mpStatus.dormie ? 'Dormie'
                    : `noch ${mpStatus.remaining} ${mpStatus.remaining === 1 ? 'Loch' : 'Löcher'}`}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Loch-für-Loch: wer hat welches Loch geholt ── */}
      {mpStatus && (
        <div className="mx-3 mt-2">
          <HoleByHoleTable
            rows={matchPlayHoleRun(holes)}
            labelA={nameA || tA}
            labelB={nameB || tB}
            colorA={TEAM_A}
            colorB={TEAM_B}
          />
        </div>
      )}

      {/* ── team names ── */}
      <div className="grid mx-3 my-3 rounded-card overflow-hidden bg-surface border border-line"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <div className="px-4 py-3" style={{ background: 'rgba(155,181,201,0.08)' }}>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1 text-teamA">{tA}</p>
          <p className="font-semibold text-sm leading-tight text-ink truncate">{nameA || '—'}</p>
        </div>
        <div className="flex items-center justify-center px-4 border-l border-r border-lineSoft">
          <span className="text-xs font-bold tracking-widest text-line">VS</span>
        </div>
        <div className="px-4 py-3 text-right" style={{ background: 'rgba(217,163,142,0.08)' }}>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1 text-teamB">{tB}</p>
          <p className="font-semibold text-sm leading-tight text-ink truncate">{nameB || '—'}</p>
        </div>
      </div>

      {/* ── social bar ── */}
      <div className="mx-3 mb-2 rounded-xl bg-surface border border-line overflow-hidden">
        <SocialBar matchId={matchId}
          likes={socialCount.likes} comments={socialCount.comments} liked={iLiked}
          onCommentClick={() => {
            const el = document.getElementById('comments-anchor')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          onShareClick={handleShare}
          onChange={({ liked, likes }) => { setILiked(liked); setSocialCount(s => ({ ...s, likes })) }}
        />
      </div>

      {/* ── Story Overlay CTA (Strava-style) ── */}
      {done && (
        <button
          onClick={() => setStoryOpen(true)}
          className="mx-3 mb-2 w-[calc(100%-1.5rem)] flex items-center justify-between px-4 py-3 hairline bg-bg active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D9C9A8"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M16 8h.01M3 16l5-5a2 2 0 012.83 0L21 19" />
            </svg>
            <span className="text-[12px] font-medium tracking-[0.22em] uppercase text-ink">
              Story Overlay
            </span>
          </div>
          <span className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
            Strava-Style
          </span>
        </button>
      )}

      {/* ── course banner ── */}
      <div className="mx-3 mb-2 rounded-xl px-4 py-2.5 flex items-center justify-between bg-surface border border-line">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D9C9A8"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M2 22h20M5 22V11l5-3 5 3v11M9 22V14h2v8" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">
              {course?.name || 'Kein Platz gewählt'}
            </p>
            {course && (
              <p className="text-[10px] text-inkDim truncate">
                {[course.city, course.country].filter(Boolean).join(', ')}
                {course.total_par > 0 && <span> · Par {course.total_par}</span>}
                {course.contributor_count > 0 && <span> · {course.contributor_count} Edits</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!locked && !done && (
            <button onClick={() => setShowCoursePicker(true)}
              className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-bg text-inkMuted border border-line active:scale-95 transition-transform">
              {course ? 'Platz' : 'Wählen'}
            </button>
          )}
          {course && !locked && !done && (
            <button onClick={() => setShowCourseEditor(true)}
              className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-accent/15 text-accent border border-accent/30 active:scale-95 transition-transform">
              Par-Editor
            </button>
          )}
          {flightPlayers.length > 0 && (
            <button onClick={() => setScorecardOpen(true)}
              className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-accent text-brandDark active:scale-95 transition-transform">
              Karten
            </button>
          )}
          {!locked && !done && !match.photo_url && (
            <button onClick={() => photoInputRef.current?.click()} disabled={photoBusy}
              className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-bg text-inkMuted border border-line active:scale-95 transition-transform disabled:opacity-50">
              {photoBusy ? '…' : '+ Foto'}
            </button>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handlePhotoChange} />
        </div>
      </div>
      {photoError && (
        <p className="mx-3 -mt-1 mb-2 text-[11px] text-danger">{photoError}</p>
      )}

      {/* ── lock banner ── */}
      {locked && !done && (
        <div className="mx-3 mb-2 rounded-xl px-4 py-3 flex items-center justify-between bg-lock/8 border border-lock/25">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5b94a"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span className="text-xs font-semibold text-lock">Schreibgeschützt</span>
          </div>
          <button
            onClick={() => setShowGate(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-lock text-brandDark active:scale-95 transition-transform"
          >
            Entsperren
          </button>
        </div>
      )}

      {/* ── column header ── */}
      <div className="grid px-4 py-2 border-b border-lineSoft bg-bg/60 sticky"
        style={{ gridTemplateColumns: COLS, top: 'calc(env(safe-area-inset-top) + 64px)' }}>
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-inkMuted">Par</span>
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-center truncate text-teamA">{tA}</span>
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-center truncate text-teamB">{tB}</span>
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-center text-inkMuted">Pts</span>
      </div>

      {/* ── 18 hole rows ── */}
      {holes.map(h => {
        const played = h.winner !== null
        return (
          <div
            key={h.hole_number}
            className="grid px-4 py-2 items-center border-b border-lineSoft"
            style={{ gridTemplateColumns: COLS, minHeight: '64px' }}
          >
            {/* PAR + hole number */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => adjustPar(h.hole_number, -1)}
                disabled={h.par <= 3 || done || locked}
                className="flex items-center justify-center rounded-xl text-lg font-bold transition-opacity disabled:opacity-20 active:scale-90 bg-surface2 text-inkMuted"
                style={{ width: 30, height: 30 }}
              >–</button>
              <div className="text-center" style={{ minWidth: 22 }}>
                <p className="font-condensed font-black text-xl leading-none text-ink tabular-nums">{h.par}</p>
                <p className="text-[9px] leading-none mt-0.5 text-inkDim tabular-nums">{h.hole_number}</p>
              </div>
              <button
                onClick={() => adjustPar(h.hole_number, 1)}
                disabled={h.par >= 5 || done || locked}
                className="flex items-center justify-center rounded-xl text-lg font-bold transition-opacity disabled:opacity-20 active:scale-90 bg-surface2 text-inkMuted"
                style={{ width: 30, height: 30 }}
              >+</button>
            </div>

            {/* Team A strokes */}
            <div className="px-1.5">
              <input
                type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="20"
                value={h.strokes_a}
                onChange={e => handleStroke(h.hole_number, 'strokes_a', e.target.value)}
                placeholder="–"
                disabled={done || locked}
                className="w-full h-14 text-center font-condensed font-black text-2xl rounded-2xl tabular-nums transition-all disabled:opacity-50"
                style={{
                  background: played && h.winner === 'A' ? 'rgba(155,181,201,0.18)'
                    : played ? 'rgb(var(--c-surface))' : 'rgb(var(--c-surface2))',
                  color: played && h.winner === 'A' ? TEAM_A
                    : played ? 'rgb(var(--c-inkDim))' : 'rgb(var(--c-ink))',
                  border: played && h.winner === 'A'
                    ? '1.5px solid rgba(155,181,201,0.45)'
                    : '1.5px solid transparent',
                }}
              />
            </div>

            {/* Team B strokes */}
            <div className="px-1.5">
              <input
                type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="20"
                value={h.strokes_b}
                onChange={e => handleStroke(h.hole_number, 'strokes_b', e.target.value)}
                placeholder="–"
                disabled={done || locked}
                className="w-full h-14 text-center font-condensed font-black text-2xl rounded-2xl tabular-nums transition-all disabled:opacity-50"
                style={{
                  background: played && h.winner === 'B' ? 'rgba(217,163,142,0.18)'
                    : played ? 'rgb(var(--c-surface))' : 'rgb(var(--c-surface2))',
                  color: played && h.winner === 'B' ? TEAM_B
                    : played ? 'rgb(var(--c-inkDim))' : 'rgb(var(--c-ink))',
                  border: played && h.winner === 'B'
                    ? '1.5px solid rgba(217,163,142,0.45)'
                    : '1.5px solid transparent',
                }}
              />
            </div>

            {/* Result dot (Match Play) oder Stableford-Punkte-Pille */}
            <div className="flex items-center justify-center">
              {isStableford
                ? <StablefordPill a={stablefordPoints(h.strokes_a, h.par)} b={stablefordPoints(h.strokes_b, h.par)} />
                : <ResultDot winner={h.winner} />}
            </div>
          </div>
        )
      })}

      {/* Finish button */}
      {!done && !locked && played.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setConfirmFinish(true)}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide active:scale-[0.98] transition-transform bg-surface text-ink border border-line hover:border-accent/50"
          >
            Match beenden
          </button>
        </div>
      )}

      {/* Comments */}
      <div id="comments-anchor" />
      <CommentsThread matchId={matchId} />

      {/* ── fixed bottom summary ── */}
      <div
        className="fixed inset-x-0 z-40 bg-surface/96 backdrop-blur-md border-t border-line shadow-lift"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-lg mx-auto grid py-3" style={{ gridTemplateColumns: COLS, paddingLeft: 'calc(1rem + env(safe-area-inset-left))', paddingRight: 'calc(1rem + env(safe-area-inset-right))' }}>
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1 text-inkMuted">Par</p>
            <p className="font-condensed font-black text-2xl leading-none text-ink tabular-nums">{totalPar}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1 text-teamA truncate">{tA}</p>
            <p className="font-condensed font-black text-2xl leading-none text-ink tabular-nums">{totA || '—'}</p>
            {dA !== null && (
              <p className="text-[11px] font-bold mt-0.5 tabular-nums"
                style={{ color: dA > 0 ? '#ef4444' : dA < 0 ? '#D9C9A8' : 'rgb(var(--c-inkDim))' }}>
                {fmtDelta(dA)}
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1 text-teamB truncate">{tB}</p>
            <p className="font-condensed font-black text-2xl leading-none text-ink tabular-nums">{totB || '—'}</p>
            {dB !== null && (
              <p className="text-[11px] font-bold mt-0.5 tabular-nums"
                style={{ color: dB > 0 ? '#ef4444' : dB < 0 ? '#D9C9A8' : 'rgb(var(--c-inkDim))' }}>
                {fmtDelta(dB)}
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1 text-inkMuted">Pts</p>
            <p className="font-condensed font-black text-lg leading-none tabular-nums">
              <span style={{ color: ptsA >= ptsB ? '#D9C9A8' : '#9ca3af' }}>{fmtPts(ptsA)}</span>
              <span className="text-line">:</span>
              <span style={{ color: ptsB > ptsA ? '#D9C9A8' : '#9ca3af' }}>{fmtPts(ptsB)}</span>
            </p>
          </div>
        </div>
      </div>

      {confirmFinish && (
        <ConfirmDialog
          message="Match beenden?"
          confirmText="Beenden"
          onConfirm={handleFinish}
          onCancel={() => setConfirmFinish(false)}
        />
      )}

      {showGate && match?.tournament && (
        <PasswordGate
          tournamentId={match.tournament.id}
          onSuccess={() => { setShowGate(false) }}
          onCancel={() => setShowGate(false)}
        />
      )}

      {showViewGate && match?.tournament && (
        <PasswordGate
          viewMode
          tournamentId={match.tournament.id}
          onSuccess={() => setShowViewGate(false)}
          onCancel={() => { setShowViewGate(false); navigate(-1) }}
        />
      )}

      {showCoursePicker && (
        <CoursePicker
          value={course}
          onChange={(c) => pickCourse(c)}
          onClose={() => setShowCoursePicker(false)}
        />
      )}

      {showCourseEditor && course && (
        <CourseEditor
          course={{ ...course, hole_pars: holes.map(h => h.par) }}
          sourceMatchId={matchId}
          onClose={() => setShowCourseEditor(false)}
          onSaved={(updated) => setCourse(prev => ({ ...prev, ...updated }))}
        />
      )}

      {scorecardOpen && (
        <ScorecardSheet
          match={match}
          players={flightPlayers}
          holes={holes}
          onClose={() => setScorecardOpen(false)}
        />
      )}

      <WinnerCardSheet
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        shareUrl={`https://app.swingandsavor.at/matches/${matchId}`}
        payload={{
          playerName:   match?.winner === 'A'
                          ? (flightNames.A.join(' · ') || match?.tournament?.team_a_name || 'Team A')
                          : match?.winner === 'B'
                          ? (flightNames.B.join(' · ') || match?.tournament?.team_b_name || 'Team B')
                          : 'Halved',
          championName: match?.winner === 'A'
                          ? (flightNames.A.join(' · ') || match?.tournament?.team_a_name || 'Team A')
                          : match?.winner === 'B'
                          ? (flightNames.B.join(' · ') || match?.tournament?.team_b_name || 'Team B')
                          : 'Halved',
          award:        match?.winner === 'halved' ? 'Tied' : 'Champion',
          cupName:      match?.tournament?.name,
          courseName:   course?.name,
          dateLabel:    match?.tournament?.date
                          ? formatCupDate(match.tournament.date, { day: '2-digit', month: 'short', year: 'numeric' })
                          : null,
          score:        `${fmtPts(ptsA)} – ${fmtPts(ptsB)}`,
          scoreLabel:   'Final Score',
          birdies:      null,
          longestDrive: null,
          closestToPin: null,
          isChampion:   match?.winner !== 'halved',
        }}
      />
    </div>
  )
}
