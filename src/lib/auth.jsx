import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { getStoredReferralCode, clearStoredReferralCode } from './referral'
import { logDebug } from './debug'
import { functionUrl, authFunctionHeaders } from './functions'

async function claimReferralIfAny() {
  const code = getStoredReferralCode()
  if (!code) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const res = await fetch(functionUrl('claim-referral'), {
      method: 'POST',
      headers: { ...authFunctionHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref_code: code }),
    })
    if (res.ok) {
      clearStoredReferralCode()
    }
  } catch (e) {
    console.warn('[auth] claim-referral failed (non-fatal)', e)
  }
}

const AuthCtx = createContext({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: () => {},
  setProfileDirect: () => {},
  signOut: () => {},
})

// Distinguish "row doesn't exist" from "fetch failed". Only the former means
// we should send the user to Onboarding; the latter must keep the previous
// profile state untouched (transient errors must not wipe state).
const NOT_FOUND = Symbol('profile-not-found')

async function fetchProfileOnce(uid) {
  const t0 = Date.now()
  const { data, error, status, statusText } = await supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle()
  logDebug('profiles.fetch', {
    uid, status, statusText,
    error: error ? { code: error.code, message: error.message, details: error.details } : null,
    data_present: !!data,
    duration_ms: Date.now() - t0,
  }, uid)
  if (error) throw error
  return data || NOT_FOUND
}

async function fetchProfileWithRetry(uid, attempts = 3) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchProfileOnce(uid)
    } catch (e) {
      lastErr = e
      console.error('[auth] fetchProfile attempt', i + 1, e)
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 350 * (i + 1)))
    }
  }
  throw lastErr || new Error('profile fetch failed')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const loadedUidRef = useRef(null)
  const inflightUidRef = useRef(null)
  const inflightPromiseRef = useRef(null)

  async function loadProfile(uid, { force = false, reason = 'unknown' } = {}) {
    if (!uid) {
      loadedUidRef.current = null
      setProfile(null); setProfileChecked(true)
      logDebug('loadProfile.skip', { reason: 'no-uid', caller: reason })
      return
    }
    if (!force && loadedUidRef.current === uid) {
      setProfileChecked(true)
      logDebug('loadProfile.skip', { reason: 'already-loaded', caller: reason, uid }, uid)
      return
    }
    if (inflightUidRef.current === uid) {
      logDebug('loadProfile.join-inflight', { caller: reason, uid }, uid)
      return inflightPromiseRef.current
    }

    inflightUidRef.current = uid
    logDebug('loadProfile.start', { caller: reason, uid, force }, uid)
    const promise = (async () => {
      try {
        let result = await fetchProfileWithRetry(uid)
        logDebug('loadProfile.first-result', { uid, found: result !== NOT_FOUND }, uid)

        if (result === NOT_FOUND) {
          let refreshErr = null
          try { await supabase.auth.refreshSession() } catch (e) { refreshErr = e?.message || String(e) }
          await new Promise(r => setTimeout(r, 250))
          let secondFound = false
          try {
            const second = await fetchProfileOnce(uid)
            if (second !== NOT_FOUND) { result = second; secondFound = true }
          } catch (e) {
            console.error('[auth] late retry failed', e)
            logDebug('loadProfile.late-retry-error', { uid, error: e?.message }, uid)
          }
          logDebug('loadProfile.late-retry', { uid, secondFound, refreshErr }, uid)
        }

        if (inflightUidRef.current !== uid) {
          logDebug('loadProfile.aborted', { uid, reason: 'inflight-superseded' }, uid)
          return
        }
        if (result === NOT_FOUND) {
          setProfile(null)
          logDebug('loadProfile.done', { uid, outcome: 'NOT_FOUND' }, uid)
        } else {
          setProfile(result)
          loadedUidRef.current = uid
          logDebug('loadProfile.done', { uid, outcome: 'OK' }, uid)
        }
        setProfileChecked(true)
      } catch (e) {
        console.error('[auth] loadProfile transient failure, keeping prior state', e)
        logDebug('loadProfile.throw', { uid, error: e?.message, code: e?.code }, uid)
        setProfileChecked(true)
      } finally {
        if (inflightUidRef.current === uid) inflightUidRef.current = null
        if (inflightPromiseRef.current === promise) inflightPromiseRef.current = null
      }
    })()
    inflightPromiseRef.current = promise
    return promise
  }

  useEffect(() => {
    let cancelled = false

    // Single source of truth: onAuthStateChange. supabase-js v2 fires
    // INITIAL_SESSION shortly after subscribe with the persisted session
    // already hydrated, so we don't need a separate getSession() call (which
    // raced with INITIAL_SESSION in earlier versions and caused the profile
    // to flicker to null on reload).
    const safety = setTimeout(() => {
      if (cancelled) return
      setSessionChecked(true); setProfileChecked(true)
    }, 10000)

    logDebug('auth.boot', { ua: navigator.userAgent, href: location.href })

    // IMPORTANT: This callback is invoked by supabase-js while it holds the
    // internal auth-lock (navigator.locks). Any supabase.from()/auth.* call
    // here will deadlock because PostgREST asks for the session token, which
    // tries to acquire the SAME lock. Keep this body synchronous — defer all
    // supabase work via setTimeout(0) so it runs after the lock is released.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      const u = session?.user ?? null
      const expSec = session?.expires_at ?? null
      const ttl = expSec ? expSec * 1000 - Date.now() : null
      logDebug('auth.event', {
        event, has_user: !!u, uid: u?.id || null,
        session_expires_at: expSec, ttl_ms: ttl,
        access_token_present: !!session?.access_token,
        refresh_token_present: !!session?.refresh_token,
      }, u?.id)
      setUser(u)
      setSessionChecked(true)

      if (event === 'USER_UPDATED') return
      if (event === 'SIGNED_OUT' || !u) {
        loadedUidRef.current = null
        setProfile(null); setProfileChecked(true)
        return
      }

      // Defer all supabase calls (loadProfile, refreshSession, getSession)
      // so the auth-lock is released before they run.
      setTimeout(() => {
        if (cancelled) return
        if (event === 'TOKEN_REFRESHED') {
          if (loadedUidRef.current !== u.id) {
            loadProfile(u.id, { force: true, reason: 'TOKEN_REFRESHED' })
          }
          return
        }
        // SIGNED_IN or INITIAL_SESSION (or PASSWORD_RECOVERY)
        if (loadedUidRef.current !== u.id) {
          loadProfile(u.id, { reason: event })
        } else {
          setProfileChecked(true)
        }
        if (event === 'SIGNED_IN') claimReferralIfAny()
      }, 0)
    })

    return () => {
      cancelled = true
      clearTimeout(safety)
      sub.subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile() {
    const { data } = await supabase.auth.getUser()
    if (data?.user) await loadProfile(data.user.id, { force: true })
  }

  function setProfileDirect(p) {
    setProfile(p)
    if (p?.id) loadedUidRef.current = p.id
    setProfileChecked(true)
  }

  async function signOut() {
    try { await supabase.auth.signOut() } catch {}
    loadedUidRef.current = null
    setUser(null); setProfile(null); setProfileChecked(true)
  }

  const loading = !sessionChecked || !profileChecked

  return (
    <AuthCtx.Provider value={{ user, profile, loading, refreshProfile, setProfileDirect, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() { return useContext(AuthCtx) }
