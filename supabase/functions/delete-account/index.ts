// delete-account — DSGVO Art. 17 + Apple App Store Guideline 5.1.1(v).
//
// Authenticated user can wipe their own account: all personal rows (one
// transaction, delete_account_data), all uploaded files, then auth.users.
// Kept on purpose: withdrawal records (widerruf_requests, legal retention).
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

  const fail = (step: string, detail?: string) => {
    console.error("[delete-account] failed", step, detail ?? "")
    return new Response(JSON.stringify({ error: "delete_failed", step }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  // 1) All database rows in one transaction (migration 043,
  //    delete_account_data): profile + cascades, owned cups, challenges,
  //    friendships, scorecard uploads, debug logs, newsletter address;
  //    display names copied into other people's cups are anonymised.
  //    Fail-closed: any error aborts before the auth user is deleted, so the
  //    user can simply retry. Returns every storage object the user uploaded.
  const { data: objects, error: dataErr } = await admin.rpc("delete_account_data", {
    p_uid: uid,
    p_email: userData.user.email ?? null,
  })
  if (dataErr || !Array.isArray(objects)) return fail("data", dataErr?.message)

  // 2) Uploaded files (avatars, photos, logos, scorecard photos) via the
  //    Storage API. The objects stay owned by the user until removed, so a
  //    retry finds them again.
  const byBucket = new Map<string, string[]>()
  for (const o of objects as { bucket: string; object_name: string }[]) {
    if (!byBucket.has(o.bucket)) byBucket.set(o.bucket, [])
    byBucket.get(o.bucket)!.push(o.object_name)
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + 100))
      if (error) return fail("storage", error.message)
    }
  }

  // 3) The auth user last (support tickets cascade from auth.users).
  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr) return fail("auth", delErr.message)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  })
})
