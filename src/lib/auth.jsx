import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { getStoredReferralCode, clearStoredReferralCode } from './referral'

async function claimReferralIfAny() {
  const code = getStoredReferralCode()
  if (!code) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-referral`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
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
  throw lastErr || new Error('profile fetch failed')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const loadedUidRef = useRef(null)
  const inflightUidRef = useRef(null)

  async function loadProfile(uid, { force = false } = {}) {
    if (!uid) {
      loadedUidRef.current = null
      setProfile(null); setProfileChecked(true)
      return
    }
    if (!force && loadedUidRef.current === uid) {
      setProfileChecked(true)
      return
    }
    if (inflightUidRef.current === uid) return
    inflightUidRef.current = uid

    try {
      let result = await fetchProfileWithRetry(uid)

      // Edge case: on a fresh reload the session JWT can be in-flight
      // for refresh while the first profile query already hits the server,
      // which returns nothing under RLS. If the row "doesn't exist", give
      // the auth state a moment and try one more time with a forced token
      // refresh. This is what made the Onboarding-recovery-effect succeed
      // a second later, so we fold that retry into the auth boot.
      if (result === NOT_FOUND) {
        try { await supabase.auth.getUser() } catch {}
        await new Promise(r => setTimeout(r, 250))
        try {
          const second = await fetchProfileOnce(uid)
          if (second !== NOT_FOUND) result = second
        } catch (e) {
          console.error('[auth] late retry failed', e)
        }
      }

      if (inflightUidRef.current !== uid) return
      if (result === NOT_FOUND) {
        setProfile(null)
      } else {
        setProfile(result)
      }
      loadedUidRef.current = uid
      setProfileChecked(true)
    } catch (e) {
      console.error('[auth] loadProfile transient failure, keeping prior state', e)
      setProfileChecked(true)
    } finally {
      if (inflightUidRef.current === uid) inflightUidRef.current = null
    }
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      setSessionChecked(true)

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return
      if (event === 'SIGNED_OUT' || !u) {
        loadedUidRef.current = null
        setProfile(null); setProfileChecked(true)
        return
      }
      // SIGNED_IN or INITIAL_SESSION (or PASSWORD_RECOVERY)
      if (loadedUidRef.current !== u.id) {
        await loadProfile(u.id)
      } else {
        setProfileChecked(true)
      }
      // Fire-and-forget: claim any stored ref-code captured before signup
      if (event === 'SIGNED_IN') claimReferralIfAny()
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
