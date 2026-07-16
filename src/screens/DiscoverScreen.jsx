import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatCupDate } from '../lib/format'
import { fetchProfileMap } from '../lib/profiles'
import { promoState } from '../lib/promo'
import LoadingSpinner from '../components/LoadingSpinner'
import JoinTournamentSheet from '../components/JoinTournamentSheet'

export default function DiscoverScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [joinSheetCup, setJoinSheetCup] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, date, status, team_a_name, team_b_name, visibility, owner_id, invite_code, cover_url, location_name, format, promoted_until, promo_tier, join_mode, max_participants, entry_conditions')
      .order('date', { ascending: false })
      .limit(60)
    const list = data ?? []
    const now = Date.now()
    list.sort((a, b) => {
      const aPromo = promoState(a, now).isTop
      const bPromo = promoState(b, now).isTop
      if (aPromo && !bPromo) return -1
      if (bPromo && !aPromo) return 1
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return new Date(b.date) - new Date(a.date)
    })
    const byOwner = await fetchProfileMap(list.map(t => t.owner_id), 'id, handle, display_name')
    setFeed(list.map(t => ({ ...t, owner: byOwner[t.owner_id] })))
    setLoading(false)
  }

  async function joinByCode(e) {
    e.preventDefault()
    setJoinError(null)
    const code = joinCode.trim().toLowerCase()
    if (code.length !== 8) { setJoinError('Code ist 8 Zeichen'); return }
    if (!user) { setJoinError('Bitte zuerst anmelden'); return }
    // Server löst den Code auf und schaltet das Turnier frei (umgeht RLS, da der
    // Code selbst die Berechtigung ist). Direkter Client-Select/Upsert scheiterte
    // für private/friends-Turniere an tournaments_read bzw. invites_write.
    const { error } = await supabase.rpc('redeem_invite_code', { p_code: code })
    if (error) {
      setJoinError(error.message === 'not_found' ? 'Code unbekannt' : 'Beitritt fehlgeschlagen')
      return
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

      <div className="border-t border-lineSoft">
        {feed.map((t, idx) => <FeedRow key={t.id} t={t} idx={idx}
          onOpen={() => navigate('/board')}
          onJoin={() => setJoinSheetCup(t)} />)}
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

      {joinSheetCup && (
        <JoinTournamentSheet
          tournament={joinSheetCup}
          onClose={() => setJoinSheetCup(null)}
          onJoined={() => { setJoinSheetCup(null); load() }}
        />
      )}
    </div>
  )
}

function FeedRow({ t, idx, onOpen, onJoin }) {
  const { isTop, isHighlight } = promoState(t)

  return (
    <div
      className={`border-b border-lineSoft transition-colors ${
        isHighlight ? 'bg-accent/8' : ''
      }`}
      style={{ animationDelay: `${idx * 25}ms`,
        boxShadow: isHighlight ? 'inset 3px 0 0 var(--tw-accent, #98cd02)' : undefined }}
    >
      <button onClick={onOpen}
        className="w-full text-left px-4 py-4 active:bg-surface/50 transition-colors flex items-center gap-3">
        <div className="flex-shrink-0">
          {t.cover_url
            ? <img src={t.cover_url} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover border border-line" />
            : <div className={`w-2.5 h-2.5 rounded-full ${t.status === 'active' ? 'bg-accent animate-pulse' : 'bg-line'}`} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isTop && <PromoPin />}
            <p className="font-semibold text-sm text-ink truncate">{t.name}</p>
            <VisibilityBadge v={t.visibility} />
            {isHighlight && <HighlightBadge />}
            {t.join_mode === 'open' && <OpenJoinBadge />}
          </div>
          <p className="text-xs text-inkMuted mt-0.5 truncate">
            {formatCupDate(t.date)}
            {t.location_name && <> · <span className="text-inkDim">{t.location_name}</span></>}
            {t.format && <> · {t.format}</>}
            {t.owner && <span className="text-inkDim"> · @{t.owner.handle}</span>}
          </p>
        </div>
      </button>
      {(t.join_mode === 'open' || t.join_mode === 'request') && (
        <div className="px-4 pb-3 -mt-1 flex justify-end">
          <button onClick={onJoin}
            className="text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-lg bg-accent text-brandDark active:scale-95 transition-transform">
            {t.join_mode === 'open' ? 'Mitspielen' : 'Beitritt anfragen'}
          </button>
        </div>
      )}
    </div>
  )
}

function PromoPin() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-brandDark bg-accent border border-accent">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
      Top
    </span>
  )
}

function HighlightBadge() {
  return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-accent bg-accent/15 border border-accent/40">Highlight</span>
}

function OpenJoinBadge() {
  return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-teamA bg-teamA/12 border border-teamA/30">Offen</span>
}

function VisibilityBadge({ v }) {
  if (v === 'public') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-accent bg-accent/12 border border-accent/30">Öffentlich</span>
  if (v === 'friends') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-teamA bg-teamA/12 border border-teamA/30">Freunde</span>
  if (v === 'private') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-lock bg-lock/12 border border-lock/30">Privat</span>
  return null
}
