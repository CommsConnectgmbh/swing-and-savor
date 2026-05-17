// send-push — VAPID-signed Web-Push für Swing & Savor
//
// Wird intern vom DB-Trigger (über pg_net) gerufen mit { user_ids:[uuid], payload:{...} }.
// Lädt push_subscriptions der adressierten User und schickt jedem Endpoint eine
// Web-Push-Nachricht. Tote Subscriptions (410/404) werden aus der DB entfernt.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import * as webpush from "https://esm.sh/@negrel/webpush@0.3.0"

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!
const SVC_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hi@swingandsavor.at"

const supabase = createClient(SUPABASE_URL, SVC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let appServer: webpush.ApplicationServer | null = null
async function vapidAppServer() {
  if (appServer) return appServer
  const keys = await webpush.importVapidKeys(
    { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE },
    { extractable: false },
  )
  appServer = await webpush.ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys: keys,
  })
  return appServer
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 })
  }
  let body: any
  try { body = await req.json() } catch { return new Response("bad json", { status: 400 }) }

  const userIds: string[] = Array.isArray(body?.user_ids) ? body.user_ids : []
  const payload = body?.payload ?? {}
  if (userIds.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { "content-type": "application/json" } })

  // Subscriptions laden
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,keys")
    .in("user_id", userIds)
    .eq("platform", "web")
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } })

  const app = await vapidAppServer()
  let sent = 0, removed = 0
  const json = JSON.stringify(payload)

  for (const sub of subs ?? []) {
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) continue
    try {
      const subscriber = app.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        expirationTime: null,
      })
      await subscriber.pushTextMessage(json, { urgency: "normal", ttl: 60 * 60 * 24 })
      sent++
      await supabase.from("push_subscriptions")
        .update({ last_seen_at: new Date().toISOString() }).eq("id", sub.id)
    } catch (e: any) {
      // 404/410 = Endpoint tot, raus damit
      const msg = String(e?.message || e)
      if (/410|404|gone|not\s*found/i.test(msg)) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        removed++
      } else {
        console.error("[send-push]", sub.endpoint, msg)
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, removed }), {
    headers: { "content-type": "application/json" },
  })
})
