// widerruf — Online-Widerrufsfunktion (Art. 11a Verbraucherrechte-RL 2011/83/EU
// i.d.F. RL (EU) 2023/2673), gesetzlich verpflichtend ab 19.06.2026.
//
// Authentifizierter Verbraucher widerruft einen kostenpflichtigen Kauf (Boost oder
// Premium-Paket) innerhalb der 14-tägigen Widerrufsfrist ab paid_at. Die Funktion
// prüft serverseitig die Eligibility, erstattet die Zahlung via Stripe-Refund,
// markiert den Kauf als 'refunded' + widerrufen_at, protokolliert die Widerrufs-
// erklärung revisionssicher in widerruf_requests und schickt dem Verbraucher eine
// Eingangsbestätigung auf dauerhaftem Datenträger (E-Mail) mit Inhalt der Erklärung
// + Datum/Uhrzeit des Eingangs (Art. 11a Abs. 4).
//
// verify_jwt ist absichtlich false, damit wir saubere 401-JSON-Antworten liefern
// können. Wir validieren das Bearer-JWT selbst gegen auth.getUser().

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const FROM = "Swing & Savor <hi@swingandsavor.at>"
const REPLY_TO = "hi@swingandsavor.at"
const WIDERRUF_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

const PURCHASE_TABLES = ["tournament_promotions", "premium_purchases"] as const
type PurchaseTable = typeof PURCHASE_TABLES[number]

const TIER_LABEL: Record<string, string> = {
  top: "Nach oben schieben",
  highlight: "Highlight",
  both: "Top + Highlight",
}
const PACKAGE_LABEL: Record<string, string> = {
  premium: "Premium-Paket",
  club: "Club-Paket",
  league: "League-Paket",
}

function j(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "Content-Type": "application/json", ...CORS, ...(init.headers || {}) },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function fmtEur(cents: number | null | undefined): string {
  if (cents == null) return "—"
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

function contractLabelFor(table: PurchaseTable, row: Record<string, unknown>): string {
  if (table === "tournament_promotions") {
    const tier = TIER_LABEL[String(row.tier)] ?? "Boost"
    const days = row.duration_days ? `${row.duration_days} Tage` : null
    return [`Boost „${tier}"`, days].filter(Boolean).join(" · ")
  }
  return PACKAGE_LABEL[String(row.package_type)] ?? "Premium-Kauf"
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, { status: 405 })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? ""
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? ""

  // ── Auth: Bearer-JWT selbst validieren ─────────────────────────────────────
  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!jwt) return j({ error: "missing_jwt" }, { status: 401 })

  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await authed.auth.getUser()
  if (userErr || !userData?.user?.id) return j({ error: "invalid_jwt" }, { status: 401 })
  const uid = userData.user.id
  const accountEmail = userData.user.email ?? null

  // ── Eingabe ────────────────────────────────────────────────────────────────
  let body: {
    purchase_table?: string
    purchase_id?: string
    full_name?: string
    email?: string
  } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const purchaseTable = String(body.purchase_table ?? "") as PurchaseTable
  const purchaseId = String(body.purchase_id ?? "").trim()
  const fullName = String(body.full_name ?? "").trim().slice(0, 200)
  const email = (String(body.email ?? "").trim() || accountEmail || "").toLowerCase().slice(0, 254)

  if (!PURCHASE_TABLES.includes(purchaseTable)) {
    return j({ error: "invalid_purchase_table" }, { status: 400 })
  }
  if (!purchaseId) return j({ error: "missing_purchase_id" }, { status: 400 })
  if (!fullName) return j({ error: "missing_full_name" }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return j({ error: "invalid_email" }, { status: 400 })
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  const userAgent = req.headers.get("user-agent") || null

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Kauf laden + Eligibility serverseitig prüfen ───────────────────────────
  const { data: purchase, error: pErr } = await admin
    .from(purchaseTable)
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle()

  if (pErr) return j({ error: "lookup_failed", detail: pErr.message }, { status: 500 })
  if (!purchase) return j({ error: "purchase_not_found" }, { status: 404 })

  // Eigentümerschaft: der widerrufende Nutzer muss der Käufer sein.
  if (purchase.buyer_profile_id !== uid) {
    return j({ error: "not_your_purchase" }, { status: 403 })
  }
  if (purchase.status !== "paid") {
    return j({ error: "not_refundable", reason: "status_not_paid" }, { status: 409 })
  }
  if (purchase.widerrufen_at) {
    return j({ error: "already_widerrufen" }, { status: 409 })
  }
  if (!purchase.paid_at) {
    return j({ error: "not_refundable", reason: "no_paid_at" }, { status: 409 })
  }
  const paidAt = new Date(purchase.paid_at as string)
  if (Date.now() - paidAt.getTime() > WIDERRUF_WINDOW_MS) {
    return j({ error: "widerruf_period_expired" }, { status: 409 })
  }

  const contractLabel = contractLabelFor(purchaseTable, purchase)
  const now = new Date()
  const widerrufText = [
    `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über: ${contractLabel}.`,
    `Kauf bezahlt am: ${paidAt.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}.`,
    `Betrag: ${fmtEur(purchase.amount_eur_cents as number)}.`,
    `Name: ${fullName}`,
    `E-Mail: ${email}`,
  ].join("\n")

  // ── Stripe-Refund (Rückabwicklung) ─────────────────────────────────────────
  let refundId: string | null = null
  let refundAmountCents: number | null = null
  const paymentIntentId = (purchase.stripe_payment_intent_id as string | null) ?? null

  if (stripeKey && paymentIntentId) {
    try {
      const params = new URLSearchParams()
      params.set("payment_intent", paymentIntentId)
      params.set("reason", "requested_by_customer")
      const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      })
      if (refundRes.ok) {
        const refund = (await refundRes.json()) as { id?: string; amount?: number }
        refundId = refund.id ?? null
        refundAmountCents = refund.amount ?? (purchase.amount_eur_cents as number) ?? null
      } else {
        const errTxt = await refundRes.text()
        console.error("[widerruf] stripe refund failed", refundRes.status, errTxt)
      }
    } catch (e) {
      // Refund fehlgeschlagen — Widerruf bleibt wirksam, manuelle Nachbearbeitung.
      console.error("[widerruf] stripe refund threw", e)
    }
  }

  // ── Kauf als widerrufen markieren ──────────────────────────────────────────
  const { error: updErr } = await admin
    .from(purchaseTable)
    .update({ status: "refunded", widerrufen_at: now.toISOString() })
    .eq("id", purchaseId)
    .eq("buyer_profile_id", uid)
  if (updErr) {
    console.error("[widerruf] purchase update failed", updErr)
  }

  // Boost: aktive Promotion auf dem Turnier sofort entfernen.
  if (purchaseTable === "tournament_promotions" && purchase.tournament_id) {
    await admin
      .from("tournaments")
      .update({ promoted_until: null, promo_tier: null })
      .eq("id", purchase.tournament_id)
  }

  // ── Widerrufserklärung revisionssicher protokollieren ──────────────────────
  const { data: inserted, error: insErr } = await admin
    .from("widerruf_requests")
    .insert({
      profile_id: uid,
      purchase_table: purchaseTable,
      purchase_id: purchaseId,
      full_name: fullName,
      email,
      contract_label: contractLabel,
      widerruf_text: widerrufText,
      refund_id: refundId,
      refund_amount_cents: refundAmountCents,
      ip,
      user_agent: userAgent,
    })
    .select("id,requested_at")
    .maybeSingle()
  if (insErr) console.error("[widerruf] log insert failed", insErr)

  const requestId = inserted?.id ?? "—"
  const requestedAt = inserted?.requested_at ?? now.toISOString()

  // ── Eingangsbestätigung per E-Mail (Art. 11a Abs. 4) ───────────────────────
  let confirmationSent = false
  if (resendKey) {
    const received = new Date(requestedAt).toLocaleString("de-DE", {
      dateStyle: "long",
      timeStyle: "short",
    })
    const refundLine =
      refundAmountCents && refundAmountCents > 0
        ? `<div><strong>Erstattung:</strong> ${escapeHtml(fmtEur(refundAmountCents))} — wird auf dein ursprüngliches Zahlungsmittel zurückgebucht.</div>`
        : `<div><strong>Erstattung:</strong> Deine Zahlung wird unverzüglich, spätestens binnen 14 Tagen, auf dein ursprüngliches Zahlungsmittel zurückerstattet.</div>`

    const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0d271e;background:#f4f7f2;margin:0;padding:32px 16px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8de;border-radius:16px;padding:32px;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Widerruf eingegangen</h1>
<p style="margin:0 0 24px;color:#5b6b62;font-size:14px;line-height:1.55;">Hallo ${escapeHtml(fullName)}, wir bestätigen den Eingang deines Widerrufs. Du musst nichts weiter tun.</p>
<div style="margin:0 0 24px;padding:16px;background:#f4f7f2;border-radius:12px;font-size:14px;line-height:1.75;color:#0d271e;">
  <div><strong>Widerrufener Kauf:</strong> ${escapeHtml(contractLabel)}</div>
  <div><strong>Eingegangen am:</strong> ${escapeHtml(received)}</div>
  <div><strong>Vorgangs-ID:</strong> ${escapeHtml(String(requestId))}</div>
  ${refundLine}
</div>
<div style="margin:0 0 24px;padding:16px;background:#eef6dd;border-radius:12px;font-size:13px;line-height:1.6;color:#3d5a16;white-space:pre-line;"><strong>Inhalt deiner Widerrufserklärung:</strong>\n${escapeHtml(widerrufText)}</div>
<p style="margin:0 0 8px;color:#5b6b62;font-size:13px;line-height:1.55;">Bei Fragen einfach auf diese Mail antworten oder an <a href="mailto:hi@swingandsavor.at" style="color:#3d5a16;">hi@swingandsavor.at</a> schreiben.</p>
<hr style="border:none;border-top:1px solid #e2e8de;margin:24px 0;" />
<p style="margin:0;color:#9aa89f;font-size:11px;">Swing &amp; Savor · Comms Connect GmbH · Tal 30 · 80331 München</p>
</div>
</body></html>`

    try {
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          reply_to: REPLY_TO,
          bcc: ["hi@swingandsavor.at"],
          subject: "Eingangsbestätigung deines Widerrufs — Swing & Savor",
          html,
        }),
      })
      confirmationSent = mailRes.ok
      if (!mailRes.ok) console.error("[widerruf] resend failed", mailRes.status, await mailRes.text())
    } catch (e) {
      console.error("[widerruf] resend threw", e)
    }
  }

  if (inserted?.id && confirmationSent) {
    await admin
      .from("widerruf_requests")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", inserted.id)
  }

  return j({
    ok: true,
    request_id: inserted?.id ?? null,
    refund_amount_cents: refundAmountCents,
    confirmation_sent: confirmationSent,
  })
})
