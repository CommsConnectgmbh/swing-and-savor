import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

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
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle()
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
  // Transient fetch failure — bubble up so caller can keep prior state intact.
  throw lastErr || new Error('profile fetch failed')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  // Refs so we can dedupe loads and avoid stomping state from out-of-order
  // events (INITIAL_SESSION + manual getSession, TOKEN_REFRESHED, etc.).
  const loadedUidRef = useRef(null)   // uid we already have a profile result for
  const inflightUidRef = useRef(null) // uid currently being fetched

  async function loadProfile(uid, { force = false } = {}) {
    if (!uid) {
      loadedUidRef.current = null
      setProfile(null); setProfileChecked(true)
      return
    }
    // Already loaded for this uid? Skip unless caller forces a refresh.
    if (!force && loadedUidRef.current === uid) {
      setProfileChecked(true)
      return
    }
    // Already fetching for this uid? Don't fire a second request.
    if (inflightUidRef.current === uid) return
    inflightUidRef.current = uid

    try {
      const result = await fetchProfileWithRetry(uid)
      // Did the user change while we were in-flight? Ignore the stale result.
      if (inflightUidRef.current !== uid) return
      if (result === NOT_FOUND) {
        setProfile(null)
      } else {
        setProfile(result)
      }
      loadedUidRef.current = uid
      setProfileChecked(true)
    } catch (e) {
      // Transient failure: do NOT clobber profile state. If we already had a
      // profile for this uid, keep showing it; if not, mark checked so the app
      // moves out of the loading state (Onboarding's own recovery effect will
      // retry).
      console.error('[auth] loadProfile transient failure, keeping prior state', e)
      setProfileChecked(true)
    } finally {
      if (inflightUidRef.current === uid) inflightUidRef.current = null
    }
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        const u = data.session?.user ?? null
        setUser(u)
        setSessionChecked(true)
        if (u) await loadProfile(u.id)
        else setProfileChecked(true)
      } catch (e) {
        console.error('[auth] init exception:', e)
        if (!cancelled) { setSessionChecked(true); setProfileChecked(true) }
      }
    })()

    // Emergency timeout — only kicks in if Supabase is completely dead.
    const safety = setTimeout(() => {
      if (cancelled) return
      setSessionChecked(true); setProfileChecked(true)
    }, 10000)

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      setSessionChecked(true)

      // TOKEN_REFRESHED / USER_UPDATED: same identity, don't touch profile.
      // SIGNED_OUT: clear.
      // SIGNED_IN / INITIAL_SESSION: load if user changed.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return
      if (event === 'SIGNED_OUT' || !u) {
        loadedUidRef.current = null
        setProfile(null); setProfileChecked(true)
        return
      }
      // SIGNED_IN or INITIAL_SESSION
      if (loadedUidRef.current !== u.id) {
        await loadProfile(u.id)
      } else {
        setProfileChecked(true)
      }
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
