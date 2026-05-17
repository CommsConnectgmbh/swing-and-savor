// reviewer-bypass — Apple + Google Reviewer Login ohne Mailbox-Zugriff.
//
// Sicherheit basiert auf zwei Faktoren:
//   1. Hardcoded Email — nur apple-review@swingandsavor.at oder
//      play-review@swingandsavor.at wird akzeptiert.
//   2. Hardcoded 8-stelliger Code — nur dieser eine Wert öffnet die Tür.
// Jeder andere Zugriffsversuch endet in 403.
//
// Der Reviewer-Account wird beim ersten Login serverseitig per
// admin.generateLink('magiclink') angelegt — kein geteilter Account, kein
// gemeinsamer Datenraum. Das Frontend kann dem Reviewer entweder den
// Magic-Link öffnen oder direkt mit den Tokens eine Session herstellen.
//
// verify_jwt:false damit Reviewer ohne JWT zugreifen können.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const REVIEWERS: Record<string, string> = {
  "apple-review@swingandsavor.at": "87654321",
  "play-review@swingandsavor.at":  "87654321",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  let body: { email?: string; code?: string } | null = null
  try { body = await req.json() } catch { /* noop */ }
  const email = (body?.email ?? "").toLowerCase().trim()
  const code  = (body?.code  ?? "").trim()

  if (!email || !code || REVIEWERS[email] !== code) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // generateLink legt den User on-the-fly an (falls noch nicht vorhanden)
  // und gibt einen action_link zurück. Frontend folgt dem Link in der
  // gleichen origin — der Hash setzt dann die Session.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (error || !data?.properties?.action_link) {
    return new Response(JSON.stringify({ error: error?.message ?? "no_link" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ redirect: data.properties.action_link }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  })
})
