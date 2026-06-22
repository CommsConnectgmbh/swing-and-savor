import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fetchPlayerStats } from '../lib/stats'
import { challengeFriendOnDealBuddy, DEALBUDDY_WEB, dealBuddyStoreUrl } from '../lib/dealbuddy'
import { buildReferralLink } from '../lib/referral'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'
import AvatarPicker from '../components/AvatarPicker'
import LoadingSpinner from '../components/LoadingSpinner'
import CoursePicker from '../components/CoursePicker'
import ShareSheet from '../components/ShareSheet'
import { webPushAvailable, ensureWebPush, disableWebPush } from '../lib/webPush'
import { hasWiderrufbareKaeufe } from '../lib/widerruf'
import { functionUrl, authFunctionHeaders } from '../lib/functions'

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { handle } = useParams()
  const navigate = useNavigate()
  const { profile: me, signOut, refreshProfile, setProfileDirect } = useAuth()
  const [shareOpen, setShareOpen] = useState(false)

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: '', hcp: '', home_club: '', home_course_id: null, home_course: null })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [pushState, setPushState] = useState(null) // 'on' | 'off' | 'unavailable' | 'busy'
  const [blockedUsers, setBlockedUsers] = useState([])
  const [unblocking, setUnblocking] = useState(null)
  const [canWiderrufen, setCanWiderrufen] = useState(false)

  const isSelf = !handle || (me && handle === me.handle)
  const target = isSelf ? me : profile

  useEffect(() => {
    if (!webPushAvailable()) { setPushState('unavailable'); return }
    if (typeof Notification === 'undefined') { setPushState('unavailable'); return }
    if (Notification.permission === 'denied') { setPushState('denied'); return }
    navigator.serviceWorker?.getRegistration('/sw-push.js')
      .then((reg) => reg?.pushManager?.getSubscription())
      .then((sub) => setPushState(sub ? 'on' : 'off'))
      .catch(() => setPushState('off'))
  }, [])

  async function togglePush() {
    if (!me) return
    setPushState('busy')
    if (pushState === 'on') {
      await disableWebPush(me)
      setPushState('off')
    } else {
      const r = await ensureWebPush(me)
      setPushState(r.ok ? 'on' : (r.reason === 'denied' ? 'denied' : 'off'))
    }
  }

  async function loadBlocked() {
    if (!me?.id) return
    const { data: blocks } = await supabase.from('user_blocks')
      .select('blocked_id, created_at').order('created_at', { ascending: false })
    const ids = (blocks || []).map(b => b.blocked_id)
    if (ids.length === 0) { setBlockedUsers([]); return }
    const { data: profs } = await supabase.from('profiles')
      .select('id,handle,display_name,avatar_url').in('id', ids)
    setBlockedUsers(profs || [])
  }

  useEffect(() => { if (isSelf) loadBlocked() }, [me?.id, isSelf])

  // Widerruf-Banner nur zeigen, wenn der Nutzer mind. einen widerrufbaren Kauf hat
  // (status='paid', innerhalb 14 Tage ab paid_at, noch nicht widerrufen).
  useEffect(() => {
    let alive = true
    if (isSelf && me?.id) {
      hasWiderrufbareKaeufe(me.id).then((ok) => { if (alive) setCanWiderrufen(ok) }).catch(() => {})
    } else {
      setCanWiderrufen(false)
    }
    return () => { alive = false }
  }, [me?.id, isSelf])

  async function unblock(targetId) {
    setUnblocking(targetId)
    await supabase.rpc('unblock_user', { target: targetId })
    setUnblocking(null)
    setBlockedUsers(prev => prev.filter(b => b.id !== targetId))
  }

  async function deleteAccount() {
    if (deleteText.trim().toUpperCase() !== 'LÖSCHEN') {
      setDeleteError('Tippe LÖSCHEN zur Bestätigung')
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Keine Session — bitte neu anmelden')
      const res = await fetch(functionUrl('delete-account'), {
        method: 'POST',
        headers: { ...authFunctionHeaders(token), 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.detail || body?.error || `HTTP ${res.status}`)
      await signOut()
    } catch (e) {
      console.error('[profile] delete account', e)
      setDeleteError(e.message || 'Löschen fehlgeschlagen')
      setDeleting(false)
    }
  }

  useEffect(() => { load() }, [handle, me?.id])

  async function load() {
    setLoading(true)
    let p = isSelf ? me : null
    if (!isSelf && handle) {
      const { data } = await supabase.from('profiles').select('*').eq('handle', handle).maybeSingle()
      p = data
    }
    setProfile(p)
    if (p) {
      const [s, fr] = await Promise.all([
        fetchPlayerStats(p.id),
        !isSelf && me ? loadFriendship(p.id) : Promise.resolve(null),
      ])
      setStats(s)
      setFriendship(fr)
    }
    setLoading(false)
  }

  async function loadFriendship(otherId) {
    if (!me) return null
    const a = me.id < otherId ? me.id : otherId
    const b = me.id < otherId ? otherId : me.id
    const { data } = await supabase.from('friendships').select('*')
      .eq('user_a', a).eq('user_b', b).maybeSingle()
    return data
  }

  async function requestFriend() {
    if (!me || !target) return
    setBusy(true)
    const a = me.id < target.id ? me.id : target.id
    const b = me.id < target.id ? target.id : me.id
    await supabase.from('friendships').insert({
      user_a: a, user_b: b, requested_by: me.id, status: 'pending',
    })
    setBusy(false)
    setFriendship(await loadFriendship(target.id))
  }

  async function acceptFriend() {
    if (!me || !target || !friendship) return
    setBusy(true)
    const a = me.id < target.id ? me.id : target.id
    const b = me.id < target.id ? target.id : me.id
    await supabase.from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('user_a', a).eq('user_b', b)
    setBusy(false)
    setFriendship(await loadFriendship(target.id))
  }

  async function openEdit() {
    let home_course = null
    if (target.home_course_id) {
      const { data } = await supabase.from('courses')
        .select('id, name, city, country').eq('id', target.home_course_id).maybeSingle()
      home_course = data
    }
    setEditForm({
      display_name:    target.display_name || '',
      hcp:             target.hcp !== null && target.hcp !== undefined ? String(target.hcp) : '',
      home_club:       target.home_club || '',
      home_course_id:  target.home_course_id || null,
      home_course,
    })
    setEditError(null)
    setEditing(true)
  }

  async function saveEdit() {
    setEditError(null)
    const name = editForm.display_name.trim()
    if (!name) { setEditError('Name darf nicht leer sein'); return }
    let hcp = null
    if (editForm.hcp !== '') {
      const v = parseFloat(String(editForm.hcp).replace(',', '.'))
      if (isNaN(v) || v < 0 || v > 54) { setEditError('HCP muss zwischen 0,0 und 54,0 liegen'); return }
      hcp = v
    }
    setSavingEdit(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: name,
        hcp,
        home_club: editForm.home_course?.name || editForm.home_club.trim() || null,
        home_course_id: editForm.home_course_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', me.id)
      .select('*')
      .single()
    setSavingEdit(false)
    if (error) {
      console.error('[profile] save:', error)
      setEditError(error.message)
      return
    }
    if (data) setProfileDirect(data)
    setEditing(false)
  }

  async function removeFriend() {
    if (!me || !target) return
    setBusy(true)
    const a = me.id < target.id ? me.id : target.id
    const b = me.id < target.id ? target.id : me.id
    await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b)
    setBusy(false)
    setFriendship(null)
  }

  if (loading) return <LoadingSpinner />
  if (!target) return (
    <div className="p-8 text-center text-inkMuted text-sm">Profil nicht gefunden</div>
  )

  // Friendship state
  const isPending  = friendship?.status === 'pending'
  const isAccepted = friendship?.status === 'accepted'
  const iSent      = isPending && friendship?.requested_by === me?.id

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      {/* Back */}
      {!isSelf && (
        <button onClick={() => navigate(-1)}
          className="px-4 pt-5 pb-2 flex items-center gap-1 text-inkMuted active:scale-95 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span className="text-xs font-semibold">Zurück</span>
        </button>
      )}

      {/* Identity card */}
      <div className="text-center px-6 pt-8 pb-6">
        {isSelf ? (
          <div className="flex justify-center mb-3">
            <AvatarPicker
              userId={me.id}
              value={target.avatar_url}
              fallback={target.display_name}
              size={88}
              onChange={async (url) => {
                setSavingAvatar(true)
                const { data } = await supabase
                  .from('profiles')
                  .update({ avatar_url: url, updated_at: new Date().toISOString() })
                  .eq('id', me.id)
                  .select('*')
                  .single()
                if (data) setProfileDirect(data)
                else await refreshProfile()
                setSavingAvatar(false)
              }}
            />
          </div>
        ) : (
          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-accent/15 border-2 border-accent/40 flex items-center justify-center overflow-hidden">
            {target.avatar_url ? (
              <img src={target.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-condensed font-black text-3xl text-accent">
                {target.display_name?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
        )}
        <h1 className="font-condensed text-2xl font-bold text-ink">{target.display_name}</h1>
        <p className="text-sm text-inkMuted mt-0.5">@{target.handle}</p>
        <div className="flex justify-center gap-3 mt-3 text-[11px] text-inkDim flex-wrap">
          {target.home_club && <span>{target.home_club}</span>}
          {target.home_club && target.hcp !== null && target.hcp !== undefined && <span>·</span>}
          {target.hcp !== null && target.hcp !== undefined && (
            <span className="tabular-nums">HC {Number(target.hcp).toFixed(1)}</span>
          )}
          {target.elo_rating !== null && target.elo_rating !== undefined && target.games_played > 0 && (
            <>
              <span>·</span>
              <Link to="/leaderboard" className="tabular-nums text-accent font-bold">
                ELO {target.elo_rating}
              </Link>
            </>
          )}
          {(target.hcp === null || target.hcp === undefined) && !target.home_club && isSelf && (
            <button onClick={openEdit} className="text-accent">+ HCP & Heimatclub setzen</button>
          )}
        </div>

        {isSelf && !editing && (
          <button onClick={openEdit}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Profil bearbeiten
          </button>
        )}

        {/* Friend action */}
        {!isSelf && me && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {isAccepted ? (
              <>
                <button onClick={() => navigate(`/challenges?opponent=${target.id}`)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent text-brandDark active:scale-95 transition-transform">
                  Herausfordern
                </button>
                <button onClick={async () => {
                  const { data: cid, error } = await supabase.rpc('get_or_create_conversation', { other_user: target.id })
                  if (!error && cid) navigate(`/messages/${cid}`)
                }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-surface text-ink border border-line active:scale-95 transition-transform">
                  Nachricht
                </button>
                <button onClick={() => challengeFriendOnDealBuddy(target)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
                  💰 DealBuddy
                </button>
                <button onClick={removeFriend} disabled={busy}
                  className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-surface text-inkDim border border-line active:scale-95 transition-transform">
                  ✓ Befreundet
                </button>
              </>
            ) : isPending && iSent ? (
              <span className="px-5 py-2 rounded-xl text-xs font-bold bg-surface text-inkMuted border border-line inline-block">
                Anfrage gesendet
              </span>
            ) : isPending ? (
              <button onClick={acceptFriend} disabled={busy}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-accent text-brandDark active:scale-95 transition-transform">
                Anfrage annehmen
              </button>
            ) : (
              <button onClick={requestFriend} disabled={busy}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-accent text-brandDark active:scale-95 transition-transform">
                + Als Freund hinzufügen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit form */}
      {isSelf && editing && (
        <div className="mx-3 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">Profil bearbeiten</p>

          <div>
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Anzeigename</label>
            <input type="text"
              className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
              value={editForm.display_name}
              onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Handicap</label>
              <input type="number" step="0.1" min="0" max="54" inputMode="decimal"
                placeholder="0–54"
                className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
                value={editForm.hcp}
                onChange={e => setEditForm(f => ({ ...f, hcp: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Heimatclub</label>
              <button type="button" onClick={() => setShowCoursePicker(true)}
                className="w-full text-left bg-bg border border-line rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                <span className={editForm.home_course ? 'text-ink truncate' : 'text-inkDim'}>
                  {editForm.home_course?.name || editForm.home_club || 'Platz wählen…'}
                </span>
                {(editForm.home_course || editForm.home_club) && (
                  <span onClick={(e) => { e.stopPropagation(); setEditForm(f => ({ ...f, home_course: null, home_course_id: null, home_club: '' })) }}
                    className="text-inkMuted text-lg leading-none px-2 hover:text-danger">×</span>
                )}
              </button>
            </div>
          </div>

          {editError && <p className="text-danger text-xs pl-1">{editError}</p>}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setEditing(false)} disabled={savingEdit}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
              Abbrechen
            </button>
            <button type="button" onClick={saveEdit} disabled={savingEdit}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-60">
              {savingEdit ? 'Speichere…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="mx-3 mb-4 rounded-card bg-surface border border-line overflow-hidden">
          <div className="px-4 py-2.5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted border-b border-lineSoft">
            Match Play Statistik
          </div>
          <div className="grid grid-cols-3 divide-x divide-lineSoft">
            <StatCell value={stats.matchesPlayed} label="Matches" />
            <StatCell value={`${Math.round(stats.winRate * 100)}%`} label="Win Rate" tone={stats.winRate >= 0.5 ? 'accent' : 'muted'} />
            <StatCell value={`${Math.round(stats.holePct * 100)}%`} label="Löcher gew." tone={stats.holePct >= 0.5 ? 'accent' : 'muted'} />
          </div>
          <div className="grid grid-cols-3 divide-x divide-lineSoft border-t border-lineSoft">
            <StatCell value={stats.wins}   label="Siege"  tone="accent" />
            <StatCell value={stats.halved} label="Halved" tone="muted" />
            <StatCell value={stats.losses} label="Nieder." tone="muted" />
          </div>
        </div>
      )}

      {/* Hall of Fame deeplink — public Editorial profile */}
      {target?.handle && (
        <Link to={`/hall/${target.handle}`}
              className="mx-3 mt-2 flex items-center justify-between px-4 py-4 hairline bg-surface/40 active:scale-[0.99] transition-transform">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D9C9A8"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 01-14 0V4zM3 4h2v3a3 3 0 01-3 3M21 4h-2v3a3 3 0 003 3"/>
            </svg>
            <span className="text-[12px] font-medium tracking-[0.22em] uppercase text-ink">
              Hall of Fame
            </span>
          </div>
          <span className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
            View public →
          </span>
        </Link>
      )}

      {/* Self-only quick links */}
      {isSelf && (
        <div className="mx-3 mt-2 rounded-card bg-surface border border-line overflow-hidden">
          <ProfileLink to="/friends"     label={t('nav.friends')} />
          <ProfileLink to="/cup"         label={t('nav.cups')} />
          <ProfileLink to="/teams"       label={t('nav.teams')} />
          <ProfileLink to="/leaderboard" label={t('nav.leaderboard', 'Rangliste')} />
          <ProfileLink to="/tour"        label={t('nav.tour', 'Tour')} />
          <ProfileLink to="/support"     label={t('nav.support', 'Hilfe & Support')} last />
        </div>
      )}

      {/* Referral / Invite */}
      {isSelf && target?.ref_code && (
        <div className="mx-3 mt-4">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted pl-1 mb-1.5">{t('profile.referralHeading')}</p>
          <div className="rounded-card bg-surface border border-line p-4">
            <p className="text-xs text-inkMuted leading-relaxed">{t('referral.youGetBody')}</p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-bg border border-line px-3 py-2.5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkDim">{t('profile.yourCode')}</p>
                <p className="font-condensed font-black text-xl text-accent tracking-[0.15em] mt-0.5">{target.ref_code}</p>
              </div>
              <button onClick={() => setShareOpen(true)}
                className="px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform">
                {t('common.share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DealBuddy */}
      {isSelf && (
        <div className="mx-3 mt-4">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted pl-1 mb-1.5">DealBuddy</p>
          <a href={dealBuddyStoreUrl()} target="_blank" rel="noopener noreferrer"
            data-href-web={DEALBUDDY_WEB}
            className="flex items-center justify-between rounded-card bg-surface border border-line px-4 py-3.5 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/12 border border-accent/30 text-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-ink leading-tight">DealBuddy</p>
                <p className="text-[11px] text-inkDim leading-tight mt-0.5">Wetten auf das nächste Match, Side-Bets mit der Crew.</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" className="text-inkDim">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
        </div>
      )}

      {/* Language */}
      {isSelf && (
        <div className="mx-3 mt-4">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted pl-1 mb-1.5">{t('profile.languageLabel')}</p>
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            {SUPPORTED_LANGUAGES.map((l, idx) => {
              const active = i18n.resolvedLanguage === l.code
              return (
                <button key={l.code}
                  onClick={() => i18n.changeLanguage(l.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 active:bg-bg/40 transition-colors ${idx === SUPPORTED_LANGUAGES.length - 1 ? '' : 'border-b border-lineSoft'}`}>
                  <span className="flex items-center gap-3">
                    <span className="text-base">{l.flag}</span>
                    <span className={`text-sm font-semibold ${active ? 'text-accent' : 'text-ink'}`}>{l.name}</span>
                  </span>
                  {active && <span className="text-accent text-xs font-bold">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Notifications */}
      {isSelf && pushState && pushState !== 'unavailable' && (
        <div className="mx-3 mt-4">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted pl-1 mb-1.5">Benachrichtigungen</p>
          <div className="rounded-card bg-surface border border-line p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/12 border border-accent/30 text-accent text-lg">🔔</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">Push-Mitteilungen</p>
              <p className="text-[11px] text-inkMuted mt-0.5">
                {pushState === 'on'   && 'Aktiv — du wirst über Likes, Kommentare und Matches informiert.'}
                {pushState === 'off'  && 'Aus — schalte ein, damit du nichts verpasst.'}
                {pushState === 'denied' && 'Vom Browser blockiert — in den Einstellungen erlauben.'}
                {pushState === 'busy' && 'Moment…'}
              </p>
            </div>
            {pushState !== 'denied' && (
              <button onClick={togglePush} disabled={pushState === 'busy'}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide active:scale-95 transition-transform disabled:opacity-50 ${
                  pushState === 'on'
                    ? 'bg-surface text-inkMuted border border-line'
                    : 'bg-accent text-brandDark'
                }`}>
                {pushState === 'on' ? 'Aus' : 'Einschalten'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Blockierte Konten */}
      {isSelf && blockedUsers.length > 0 && (
        <div className="px-3 mt-4">
          <div className="rounded-card bg-surface border border-line overflow-hidden">
            <div className="px-4 py-2.5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted border-b border-lineSoft">
              Blockierte Konten <span className="opacity-50 tabular-nums">{blockedUsers.length}</span>
            </div>
            <div className="divide-y divide-lineSoft">
              {blockedUsers.map(b => (
                <div key={b.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bg border border-line flex items-center justify-center overflow-hidden">
                    {b.avatar_url
                      ? <img src={b.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="font-condensed font-black text-sm text-inkMuted">{(b.display_name || b.handle || '?')[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{b.display_name || '—'}</p>
                    <p className="text-[11px] text-inkDim truncate">@{b.handle}</p>
                  </div>
                  <button onClick={() => unblock(b.id)} disabled={unblocking === b.id}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-bg text-inkMuted border border-line active:scale-95 transition-transform">
                    {unblocking === b.id ? '…' : 'Entsperren'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sign out + Legal + Konto löschen */}
      {isSelf && (
        <div className="px-3 mt-4 flex flex-col gap-2">
          {canWiderrufen && (
            <button onClick={() => navigate('/widerruf')}
              className="w-full py-3 rounded-xl text-sm font-bold bg-accent/12 text-accent border border-accent/40 active:scale-[0.98] transition-transform">
              {t('widerruf.bannerCta')}
            </button>
          )}

          <button onClick={signOut}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-surface text-inkMuted border border-line active:scale-[0.98] transition-transform">
            {t('common.signOut')}
          </button>

          {/* Dauerhafter, plattformübergreifender Zugang zur Widerruf-Ansicht (§ 356a BGB).
              Immer sichtbar — die Widerruf-Ansicht listet widerrufbare Käufe selbst bzw. zeigt
              einen Leer-Zustand. Nicht auf canWiderrufen gegatet. */}
          <button onClick={() => navigate('/widerruf')}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-surface text-inkMuted border border-line active:scale-[0.98] transition-transform">
            {t('widerruf.permanentLink')}
          </button>

          <div className="flex gap-2 text-[11px] text-inkDim justify-center pt-1">
            <a href="https://swingandsavor.at/impressum" target="_blank" rel="noopener" className="hover:text-inkMuted">{t('profile.impressum')}</a>
            <span>·</span>
            <a href="https://swingandsavor.at/datenschutz" target="_blank" rel="noopener" className="hover:text-inkMuted">{t('profile.datenschutz')}</a>
            <span>·</span>
            <a href="https://swingandsavor.at/agb" target="_blank" rel="noopener" className="hover:text-inkMuted">{t('profile.agb')}</a>
            <span>·</span>
            <a href="mailto:hi@swingandsavor.at" className="hover:text-inkMuted">{t('profile.support')}</a>
          </div>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold text-danger/80 hover:text-danger transition-colors">
              {t('profile.deleteAccount')}
            </button>
          ) : (
            <div className="mt-2 rounded-card p-4 bg-surface border border-danger/30 flex flex-col gap-3 animate-fade-up">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-danger">{t('profile.deleteConfirmTitle')}</p>
              <p className="text-xs text-inkMuted leading-relaxed">
                {t('profile.deleteConfirmBody')}
              </p>
              <input type="text" autoCapitalize="characters" autoCorrect="off"
                placeholder={t('profile.deleteConfirmPrompt')}
                className="w-full bg-bg border border-line rounded-xl px-4 py-2.5 text-ink placeholder:text-inkDim text-sm focus:border-danger/60"
                value={deleteText}
                onChange={e => { setDeleteText(e.target.value); setDeleteError(null) }}
              />
              {deleteError && <p className="text-danger text-xs">{deleteError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteText(''); setDeleteError(null) }}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
                  {t('common.cancel')}
                </button>
                <button type="button" onClick={deleteAccount} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-danger text-white active:scale-[0.98] transition-transform disabled:opacity-60">
                  {deleting ? t('common.deleting') : t('profile.deleteFinal')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isSelf && target?.ref_code && (
        <ShareSheet
          open={shareOpen} onClose={() => setShareOpen(false)}
          url={buildReferralLink(target.ref_code)}
          text={t('share.inviteText', { url: buildReferralLink(target.ref_code) })}
          title={t('profile.shareLink')}
        />
      )}

      {showCoursePicker && (
        <CoursePicker
          value={editForm.home_course}
          onChange={(c) => setEditForm(f => ({ ...f, home_course: c, home_course_id: c?.id || null }))}
          onClose={() => setShowCoursePicker(false)}
        />
      )}

      <div className="h-6" />
    </div>
  )
}

function ProfileLink({ to, label, last }) {
  return (
    <Link to={to}
      className={`flex items-center justify-between px-4 py-3.5 active:bg-bg/40 transition-colors ${last ? '' : 'border-b border-lineSoft'}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" className="text-inkDim">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  )
}

function StatCell({ value, label, tone = 'ink' }) {
  const cls = tone === 'accent' ? 'text-accent' : tone === 'muted' ? 'text-inkMuted' : 'text-ink'
  return (
    <div className="text-center py-3.5">
      <p className={`font-condensed font-black text-2xl leading-none tabular-nums ${cls}`}>{value}</p>
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mt-1 text-inkDim">{label}</p>
    </div>
  )
}
