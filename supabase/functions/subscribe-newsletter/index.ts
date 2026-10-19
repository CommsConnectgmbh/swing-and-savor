// Newsletter-Anmeldung mit Double-Opt-In und Abmeldung. verify_jwt=false.
// Basis: live deployte Version 9 (Stand 2026-10-18); ergaenzt um die Abmeldung
// (?unsubscribe=TOKEN: GET -> Abmeldeseite, POST -> abmelden, One-Click nach RFC 8058).
// Newsletter-Mails nur ueber _shared/newsletter.ts newsletterNachricht() bauen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { abmeldeAktion } from "../_shared/newsletter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FROM = "Swing & Savor <hi@swingandsavor.at>";
const REPLY_TO = "hi@swingandsavor.at";
const SITE = "https://swingandsavor.at";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function randToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CONFIRM_COPY: Record<string, { subj: string; html: (link: string) => string }> = {
  en: {
    subj: "Confirm your Swing & Savor subscription",
    html: (link) => `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d271e;"><h2>Almost there 🏌️</h2><p>Tap the button below to confirm your email and stay in the loop about new cups, native-app releases and the occasional tip.</p><p><a href="${link}" style="display:inline-block;background:#98cd02;color:#0d271e;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">Confirm subscription</a></p><p style="color:#6b7280;font-size:13px;">Didn't sign up? Just ignore this email.</p></div>`,
  },
  de: {
    subj: "Bestätige deine Swing & Savor Anmeldung",
    html: (link) => `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d271e;"><h2>Fast geschafft 🏌️</h2><p>Klick den Button unten, um deine E-Mail-Adresse zu bestätigen und Updates zu neuen Cups, Native-App-Releases und gelegentlichen Tipps zu erhalten.</p><p><a href="${link}" style="display:inline-block;background:#98cd02;color:#0d271e;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">Anmeldung bestätigen</a></p><p style="color:#6b7280;font-size:13px;">Nicht angemeldet? Einfach ignorieren.</p></div>`,
  },
  es: {
    subj: "Confirma tu suscripción a Swing & Savor",
    html: (link) => `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d271e;"><h2>Casi listo 🏌️</h2><p>Toca el botón para confirmar tu email y mantenerte al día con nuevos torneos, lanzamientos nativos y consejos ocasionales.</p><p><a href="${link}" style="display:inline-block;background:#98cd02;color:#0d271e;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">Confirmar suscripción</a></p><p style="color:#6b7280;font-size:13px;">¿No te suscribiste? Ignora este email.</p></div>`,
  },
  fr: {
    subj: "Confirme ton inscription Swing & Savor",
    html: (link) => `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d271e;"><h2>Presque fait 🏌️</h2><p>Clique sur le bouton pour confirmer ton e-mail et rester au courant des nouveaux tournois, sorties natives et astuces.</p><p><a href="${link}" style="display:inline-block;background:#98cd02;color:#0d271e;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">Confirmer l'inscription</a></p><p style="color:#6b7280;font-size:13px;">Pas inscrit ? Ignore cet email.</p></div>`,
  },
  ja: {
    subj: "Swing & Savor の登録を確認",
    html: (link) => `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d271e;"><h2>あと一歩 🏌️</h2><p>下のボタンをタップして登録を確認してください。新しいカップ、ネイティブアプリのリリース、たまにちょっとしたヒントをお届けします。</p><p><a href="${link}" style="display:inline-block;background:#98cd02;color:#0d271e;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;">登録を確認</a></p><p style="color:#6b7280;font-size:13px;">登録した覚えがない場合は無視してください。</p></div>`,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);

  // Abmeldung: ohne Login, neutrale Antwort (keine Auskunft, ob ein Abo existierte).
  const abmeldung = abmeldeAktion(req.method, url);
  if (abmeldung) {
    if (abmeldung.art === "seite") return Response.redirect(abmeldung.ziel, 302);
    if (abmeldung.art === "abmelden") {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await admin
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("confirm_token", abmeldung.token)
        .neq("status", "unsubscribed");
      if (error) {
        console.error("[subscribe-newsletter] unsubscribe failed", error.message);
        return new Response(JSON.stringify({ error: "unsubscribe_failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Confirm endpoint: GET /subscribe-newsletter?confirm=TOKEN
  if (req.method === "GET" && url.searchParams.get("confirm")) {
    const token = url.searchParams.get("confirm")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("confirm_token", token)
      .eq("status", "pending")
      .select("email")
      .maybeSingle();
    const ok = !!data && !error;
    const target = ok ? `${SITE}/?subscribed=1` : `${SITE}/?subscribed=err`;
    return Response.redirect(target, 302);
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: cors });
  }

  let body: { email?: string; lang?: string; source?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const email = (body.email || "").trim().toLowerCase();
  const lang = (body.lang || "en").slice(0, 2).toLowerCase();
  const source = (body.source || "unknown").slice(0, 64);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: "invalid email" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = randToken();

  // Upsert pending — if already confirmed, leave as-is
  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, status, confirm_token")
    .eq("email", email)
    .maybeSingle();

  let useToken = token;
  if (existing) {
    if (existing.status === "confirmed") {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    useToken = existing.confirm_token || token;
    await admin.from("newsletter_subscribers")
      .update({ lang, source, confirm_token: useToken, status: "pending" })
      .eq("id", existing.id);
  } else {
    const { error: insErr } = await admin
      .from("newsletter_subscribers")
      .insert({ email, lang, source, confirm_token: useToken, status: "pending" });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  // Send confirm mail via Resend
  const copy = CONFIRM_COPY[lang] || CONFIRM_COPY.en;
  const confirmLink = `${SUPABASE_URL}/functions/v1/subscribe-newsletter?confirm=${encodeURIComponent(useToken)}`;

  if (RESEND_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          reply_to: REPLY_TO,
          subject: copy.subj,
          html: copy.html(confirmLink),
        }),
      });
    } catch (e) {
      console.error("[subscribe-newsletter] resend failed", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
