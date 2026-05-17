// delete-account — DSGVO Art. 17 + Apple App Store Guideline 5.1.1(v).
//
// Authenticated user can wipe their own account: profile + linked rows in
// challenges/friendships/tournaments, then the auth.users row itself.
//
// verify_jwt is intentionally false so we can return a 401 JSON response
// instead of the platform's opaque rejection. We validate the JWT ourselves
// against auth.getUser() with the user's bearer token before doing anything.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing_jwt" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await authed.auth.getUser()
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "invalid_jwt" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
  const uid = userData.user.id

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Best-effort cleanup. We swallow per-step errors so one failing table
  // never blocks the auth deletion the user explicitly requested.
  // - tournament_invites cascade via profile_id FK when the profile drops
  // - players/matches/hole_results hold names, not profile_id, so they stay
  //   attached to tournaments; deleting owned tournaments cascades to them.
  const cleanupSteps = [
    admin.from("challenges").delete().or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`),
    admin.from("friendships").delete().or(`user_a.eq.${uid},user_b.eq.${uid}`),
    admin.from("tournaments").delete().eq("owner_id", uid),
    admin.from("profiles").delete().eq("id", uid),
  ]
  const cleanupResults = await Promise.allSettled(cleanupSteps)
  const cleanupErrors = cleanupResults
    .map((r, i) => r.status === "rejected"
      ? { step: i, error: String(r.reason) }
      : (r.value as any)?.error
        ? { step: i, error: (r.value as any).error.message }
        : null)
    .filter(Boolean)
  if (cleanupErrors.length) {
    console.warn("[delete-account] cleanup warnings", cleanupErrors)
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr) {
    return new Response(JSON.stringify({ error: "delete_failed", detail: delErr.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ ok: true, cleanup_warnings: cleanupErrors }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  })
})
