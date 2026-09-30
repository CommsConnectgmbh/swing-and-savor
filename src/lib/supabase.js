import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sas-auth',
  },
})

/**
 * The current user's access token (JWT), or `null` when there is no active
 * session. Centralises the `getSession()` → `session.access_token` dance that
 * was hand-copied into every authenticated edge-function call site (checkout,
 * delete-account, widerruf, …). Callers throw their own contextual error when a
 * token is required — this helper only reads it.
 */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}
