import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { logDebug, getDebugSessionId } from '../lib/debug'
import AvatarPicker from '../components/AvatarPicker'

function deriveHandle(email) {
  if (!email) return ''
  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}

async function hardReset() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) await r.unregister()
    }
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      for (const n of names) await caches.delete(n)
    }
    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}
  } finally {
    window.location.replace('/?fresh=' + Date.now())
  }
}

export default function OnboardingScreen() {
  const { user, refreshProfile, setProfileDirect, signOut } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [hcp, setHcp] = useState('')
  const [homeClub, setHomeClub] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(null)
  const [error, setError] = useState(null)

  // Pre-fill handle + a friendly default display name from email
  useEffect(() => {
    if (user?.email) {
      const local = user.email.split('@')[0]
      setHandle(prev => prev || deriveHandle(user.email))
      setDisplayName(prev => prev || local.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    }
  }, [user?.email])

  // If a profile already exists for this user, recover automatically (e.g.
  // after a boot-time auth-race). Re-poll a few times because the recovery
  // window may coincide with a token-refresh that hasn't landed yet.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    let attempts = 0
    logDebug('onboarding.mount', { uid: user.id, email: user?.email }, user.id)
    ;(async () => {
      while (!cancelled && attempts < 4) {
        attempts++
        try {
          if (attempts > 1) {
            try { await supabase.auth.refreshSession() } catch {}
          }
          const t0 = Date.now()
          const { data, error, status } = await supabase
            .from('profiles').select('*').eq('id', user.id).maybeSingle()
          logDebug('onboarding.recovery-attempt', {
            attempt: attempts, uid: user.id, status,
            error: error ? { code: error.code, message: error.message } : null,
            data_present: !!data,
            duration_ms: Date.now() - t0,
          }, user.id)
          if (cancelled) return
          if (error) {
            console.warn('[onboarding] recovery query error', error)
          } else if (data) {
            console.log('[onboarding] existing profile found, recovering')
            logDebug('onboarding.recovered', { uid: user.id, attempt: attempts }, user.id)
            setProfileDirect(data)
            navigate('/board', { replace: true })
            return
          }
        } catch (e) {
          console.warn('[onboarding] recovery attempt failed', e)
          logDebug('onboarding.recovery-throw', { attempt: attempts, error: e?.message }, user.id)
        }
        await new Promise(r => setTimeout(r, 600 * attempts))
      }
      if (!cancelled) logDebug('onboarding.recovery-exhausted', { uid: user.id }, user.id)
    })()
    return () => { cancelled = true }
  }, [user?.id])

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
    ])
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setStep(null)

    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanHandle.length < 3) { setError('Benutzername min. 3 Zeichen (a–z, 0–9, _)'); return }
    if (!displayName.trim()) { setError('Anzeigename ist Pflicht'); return }

    setBusy(true)
    try {
      // 1) confirm session is fresh — fail fast if not
      setStep('Anmeldung prüfen…')
      const sessionCheck = await withTimeout(supabase.auth.getUser(), 4000, 'auth')
      const authedUser = sessionCheck?.data?.user
      if (!authedUser?.id) {
        console.error('[onboarding] no auth user', sessionCheck)
        setError('Session abgelaufen — bitte neu anmelden')
        setBusy(false); setStep(null); return
      }

      // 2) insert profile
      setStep('Profil speichern…')
      const insertReq = supabase.from('profiles').insert({
        id: authedUser.id,
        handle: cleanHandle,
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        hcp: hcp ? parseFloat(hcp) : null,
        home_club: homeClub.trim() || null,
      }).select('*').single()

      const { data, error: err } = await withTimeout(insertReq, 8000, 'insert')

      if (err) {
        console.error('[onboarding] insert error:', err)
        if (err.code === '23505') setError('Benutzername bereits vergeben — wähl einen anderen')
        else if (err.code === '42501') setError('Berechtigungsfehler — Logout & neu anmelden')
        else setError(`${err.code || ''} ${err.message || 'Insert fehlgeschlagen'}`.trim())
        setBusy(false); setStep(null); return
      }

      // 3) commit to client state + navigate
      setStep('Fertig…')
      if (data) {
        setProfileDirect(data)
        navigate('/board', { replace: true })
      } else {
        await refreshProfile()
      }
    } catch (e) {
      console.error('[onboarding] exception:', e)
      setError(e.message || 'Verbindungsfehler — versuch es nochmal')
      setBusy(false); setStep(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8 animate-fade-up bg-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" width="64" height="64" className="rounded-2xl mx-auto mb-4"
               style={{ boxShadow: '0 0 0 1px rgba(217,201,168,0.22), 0 8px 24px rgba(0,0,0,0.55)' }} />
          <p className="text-[10px] tracking-[0.42em] uppercase text-accent mb-2">Welcome to the Clubhouse</p>
          <h1 className="font-display text-ink leading-none"
              style={{ fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: 500, letterSpacing: '-0.015em' }}>
            Set up your Golf Identity
          </h1>
          <p className="text-inkMuted text-[13px] mt-3 tracking-wide">Damit deine Crew dich findet.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex justify-center">
            <AvatarPicker
              userId={user.id}
              value={avatarUrl}
              fallback={displayName || user?.email}
              onChange={setAvatarUrl}
              size={104}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Anzeigename *</label>
            <input
              type="text" autoFocus
              placeholder="Max Mustermann"
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Benutzername *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inkDim text-sm">@</span>
              <input
                type="text" inputMode="text" autoCapitalize="none" autoCorrect="off"
                placeholder="maxm"
                className="w-full bg-surface border border-line rounded-xl pl-8 pr-4 py-3 text-ink placeholder:text-inkDim text-sm lowercase focus:border-accent/60"
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
              />
            </div>
            <p className="text-[10px] text-inkDim mt-1 pl-1">Aus deiner Email vorbelegt · 3–20 Zeichen · a–z, 0–9, _</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Handicap</label>
              <input
                type="number" step="0.1" min="0" max="54" inputMode="decimal"
                placeholder="0–54"
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
                value={hcp} onChange={e => setHcp(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 block mb-1.5">Heimatclub</label>
              <input
                type="text"
                placeholder="optional"
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
                value={homeClub} onChange={e => setHomeClub(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-danger text-xs pl-1 break-words">{error}</p>}
          {step && !error && <p className="text-accent text-xs pl-1 animate-pulse">{step}</p>}

          <button type="submit" disabled={busy}
            className="py-3.5 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50 mt-2">
            {busy ? (step || 'Lege an…') : 'Profil anlegen'}
          </button>

          <div className="flex flex-col gap-1 pt-1">
            <button type="button" onClick={signOut}
              className="text-xs text-inkDim py-1 hover:text-inkMuted transition-colors">
              Abmelden
            </button>
            <button type="button" onClick={hardReset}
              className="text-xs text-inkDim py-1 hover:text-danger transition-colors">
              App-Cache löschen & neu starten
            </button>
          </div>

          <div className="text-[10px] text-inkDim text-center pt-2 break-all">
            user: <span className="text-accent">{user?.id || '—'}</span>
          </div>
          <div className="text-[10px] text-inkDim text-center break-all">
            diag: <span className="text-accent">{getDebugSessionId()}</span>
          </div>
        </form>
      </div>
    </div>
  )
}
