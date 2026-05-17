import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fetchPlayerStats } from '../lib/stats'
import { challengeFriendOnDealBuddy } from '../lib/dealbuddy'
import AvatarPicker from '../components/AvatarPicker'
import LoadingSpinner from '../components/LoadingSpinner'
import CoursePicker from '../components/CoursePicker'

export default function ProfileScreen() {
  const { handle } = useParams()
  const navigate = useNavigate()
  const { profile: me, signOut, refreshProfile, setProfileDirect } = useAuth()

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
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
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

  const isSelf = !handle || (me && handle === me.handle)
  const target = isSelf ? me : profile

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

      {/* Self-only quick links */}
      {isSelf && (
        <div className="mx-3 mt-2 rounded-card bg-surface border border-line overflow-hidden">
          <ProfileLink to="/friends" label="Freunde" />
          <ProfileLink to="/cup"     label="Turnier-Verwaltung" />
          <ProfileLink to="/teams"   label="Spieler & Teams" last />
        </div>
      )}

      {/* Community / Discord */}
      {isSelf && (
        <div className="mx-3 mt-3">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted pl-1 mb-1.5">Community</p>
          <a href="https://discord.gg/jT2GpZqZVE" target="_blank" rel="noopener"
            className="flex items-center justify-between rounded-card bg-surface border border-line px-4 py-3.5 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#5865F2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-ink leading-tight">Discord-Community</p>
                <p className="text-[11px] text-inkDim leading-tight mt-0.5">Cups, Leaderboards, 19th Hole</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" className="text-inkDim">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
        </div>
      )}

      {/* Sign out + Legal + Konto löschen */}
      {isSelf && (
        <div className="px-3 mt-3 flex flex-col gap-2">
          <button onClick={signOut}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-surface text-inkMuted border border-line active:scale-[0.98] transition-transform">
            Abmelden
          </button>

          <div className="flex gap-2 text-[11px] text-inkDim justify-center pt-1">
            <a href="https://swingandsavor.at/impressum" target="_blank" rel="noopener" className="hover:text-inkMuted">Impressum</a>
            <span>·</span>
            <a href="https://swingandsavor.at/datenschutz" target="_blank" rel="noopener" className="hover:text-inkMuted">Datenschutz</a>
            <span>·</span>
            <a href="https://swingandsavor.at/agb" target="_blank" rel="noopener" className="hover:text-inkMuted">AGB</a>
            <span>·</span>
            <a href="mailto:hi@swingandsavor.at" className="hover:text-inkMuted">Support</a>
          </div>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold text-danger/80 hover:text-danger transition-colors">
              Konto unwiderruflich löschen
            </button>
          ) : (
            <div className="mt-2 rounded-card p-4 bg-surface border border-danger/30 flex flex-col gap-3 animate-fade-up">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-danger">Konto löschen</p>
              <p className="text-xs text-inkMuted leading-relaxed">
                Profil, Freundschaften, deine Turniere und der Zugang werden endgültig entfernt.
                Diese Aktion ist unwiderruflich.
              </p>
              <input type="text" autoCapitalize="characters" autoCorrect="off"
                placeholder='Tippe LÖSCHEN'
                className="w-full bg-bg border border-line rounded-xl px-4 py-2.5 text-ink placeholder:text-inkDim text-sm focus:border-danger/60"
                value={deleteText}
                onChange={e => { setDeleteText(e.target.value); setDeleteError(null) }}
              />
              {deleteError && <p className="text-danger text-xs">{deleteError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteText(''); setDeleteError(null) }}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
                  Abbrechen
                </button>
                <button type="button" onClick={deleteAccount} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-danger text-white active:scale-[0.98] transition-transform disabled:opacity-60">
                  {deleting ? 'Lösche…' : 'Endgültig löschen'}
                </button>
              </div>
            </div>
          )}
        </div>
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
