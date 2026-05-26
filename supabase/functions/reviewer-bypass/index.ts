// reviewer-bypass — Apple + Google Reviewer Login ohne Mailbox-Zugriff.
//
// Sicherheit basiert auf zwei Faktoren:
//   1. Hardcoded Email — nur apple-review@swingandsavor.at oder
//      play-review@swingandsavor.at wird akzeptiert.
//   2. Hardcoded 8-stelliger Code — nur dieser eine Wert öffnet die Tür.
// Jeder andere Zugriffsversuch endet in 403.
//
// Nach erfolgreicher Auth wird der Reviewer-Account idempotent mit Demo-
// Content geseedet (Profile, Turnier mit Spielern + 18-Loch Finished-Match
// + Aktiv-Match + Match-Kommentaren), damit Apple sehen kann dass die App
// vollständig funktioniert (Guideline 2.1(a) Re-Submit 2026-05-26).
//
// Der Reviewer-Account wird beim ersten Login serverseitig per
// admin.generateLink('magiclink') angelegt. WICHTIG: Wir geben NICHT den
// action_link zurück (würde auf supabase.co umleiten und in der iOS-
// Capacitor-WebView den externen Safari öffnen — Apple 2.1a Reject). Statt
// dessen geben wir token_hash zurück, das Frontend ruft verifyOtp() und
// bleibt damit komplett in der App.
//
// verify_jwt:false damit Reviewer ohne JWT zugreifen können.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const REVIEWERS: Record<string, string> = {
  "apple-review@swingandsavor.at": "87654321",
  "play-review@swingandsavor.at":  "87654321",
}

// Marker im Tournament-Namen, damit der Seed idempotent bleibt
const DEMO_TOURNAMENT_NAME = "🍃 Apple Review Demo Cup"

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
  // und gibt zusätzlich zum action_link das hashed_token zurück. Das
  // Frontend nutzt token_hash + email für supabase.auth.verifyOtp und
  // erstellt damit eine Session, ohne dass der Browser navigiert.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (error || !data?.properties?.hashed_token || !data?.user?.id) {
    return new Response(JSON.stringify({ error: error?.message ?? "no_link" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  // Demo-Content seeden (idempotent, Fehler werden geloggt aber nicht propagiert
  // — Login darf nie wegen Seed-Fehlern scheitern).
  let seeded = false
  try {
    seeded = await ensureDemoContent(admin, data.user.id, email)
  } catch (e) {
    console.error("[reviewer-bypass] seed failed", e)
  }

  return new Response(JSON.stringify({
    email,
    token_hash: data.properties.hashed_token,
    seeded,
  }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  })
})

// Seed: Profile + ein vollständig gefülltes Demo-Turnier mit zwei Matches.
// Idempotent: prüft ob Demo-Turnier (markiert durch DEMO_TOURNAMENT_NAME)
// für diesen Owner schon existiert. Wenn ja: nichts tun.
async function ensureDemoContent(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<boolean> {
  const isApple = email.startsWith("apple-")
  const handle  = isApple ? "apple_reviewer" : "play_reviewer"
  const display = isApple ? "Apple Reviewer" : "Play Reviewer"

  // 1) Profile sicherstellen — nicht überschreiben, falls Rainer manuell
  // ein Profil eingerichtet hat (Tiger W. etc.)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle()

  const reviewerDisplay = existingProfile?.display_name ?? display
  if (!existingProfile) {
    await admin.from("profiles").insert({
      id: userId,
      handle,
      display_name: display,
      hcp: 14.3,
      home_club: "Royal Demo GC",
    })
  }

  // 2) Hat dieser Reviewer schon ein Demo-Turnier?
  const { data: existing } = await admin
    .from("tournaments")
    .select("id")
    .eq("owner_id", userId)
    .eq("name", DEMO_TOURNAMENT_NAME)
    .limit(1)
    .maybeSingle()

  if (existing?.id) return false // schon geseedet

  // 3) Turnier anlegen
  const today = new Date().toISOString().slice(0, 10)
  const { data: tourn, error: tErr } = await admin
    .from("tournaments")
    .insert({
      name: DEMO_TOURNAMENT_NAME,
      date: today,
      status: "active",
      team_a_name: "Birdies",
      team_b_name: "Eagles",
      owner_id: userId,
      visibility: "public",
      description:
        "Demo-Turnier für den App-Review. Zeigt Match-Tracking, Live-Scoring, Stroke- und Match-Play, sowie Social-Features (Kommentare/Reaktionen).",
      location_name: "Royal Demo Golf Club",
      package_type: "free",
      join_mode: "open",
      team_a_color: "#9bb5c9",
      team_b_color: "#d9a38e",
    })
    .select("id")
    .single()

  if (tErr || !tourn?.id) throw tErr ?? new Error("tournament_insert_failed")
  const tournamentId = tourn.id

  // 4) Spieler anlegen (Reviewer ist Spieler 1 in Team A, profile_id verlinkt)
  const playersPayload = [
    { tournament_id: tournamentId, name: reviewerDisplay, handicap: 14.3, team: "A", profile_id: userId },
    { tournament_id: tournamentId, name: "Lena Eagle",    handicap: 11.8, team: "A" },
    { tournament_id: tournamentId, name: "Sam Birdie",    handicap: 16.2, team: "B" },
    { tournament_id: tournamentId, name: "Tom Putter",    handicap: 19.0, team: "B" },
  ]
  const { data: players, error: pErr } = await admin
    .from("players")
    .insert(playersPayload)
    .select("id, name, team")
  if (pErr || !players || players.length !== 4) throw pErr ?? new Error("players_insert_failed")

  const reviewerPlayer = players.find(p => p.name === reviewerDisplay)!
  const lenaPlayer     = players.find(p => p.name === "Lena Eagle")!
  const samPlayer      = players.find(p => p.name === "Sam Birdie")!
  const tomPlayer      = players.find(p => p.name === "Tom Putter")!

  // 5) Finished Singles Match (Reviewer vs Sam) — Reviewer gewinnt 5&4
  const { data: m1, error: m1Err } = await admin
    .from("matches")
    .insert({
      tournament_id: tournamentId,
      type: "singles",
      team_a_player1_id: reviewerPlayer.id,
      team_b_player1_id: samPlayer.id,
      status: "finished",
      winner: "A",
      visibility: "public",
    })
    .select("id")
    .single()
  if (m1Err || !m1?.id) throw m1Err ?? new Error("match1_insert_failed")

  // 6) Hole results: 18 Löcher Stroke-Play, A gewinnt insgesamt
  type Hole = { hole: number; par: number; sa: number; sb: number; w: "A"|"B"|"halved" }
  const holes: Hole[] = [
    { hole:  1, par: 4, sa: 4, sb: 5, w: "A" },
    { hole:  2, par: 4, sa: 5, sb: 5, w: "halved" },
    { hole:  3, par: 3, sa: 3, sb: 4, w: "A" },
    { hole:  4, par: 5, sa: 4, sb: 5, w: "A" }, // eagle
    { hole:  5, par: 4, sa: 4, sb: 4, w: "halved" },
    { hole:  6, par: 4, sa: 5, sb: 4, w: "B" },
    { hole:  7, par: 3, sa: 3, sb: 3, w: "halved" },
    { hole:  8, par: 5, sa: 6, sb: 6, w: "halved" },
    { hole:  9, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 10, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 11, par: 4, sa: 5, sb: 4, w: "B" },
    { hole: 12, par: 3, sa: 4, sb: 4, w: "halved" },
    { hole: 13, par: 5, sa: 5, sb: 6, w: "A" },
    { hole: 14, par: 4, sa: 4, sb: 5, w: "A" }, // closeout 5&4
    { hole: 15, par: 4, sa: 4, sb: 4, w: "halved" },
    { hole: 16, par: 3, sa: 3, sb: 4, w: "A" },
    { hole: 17, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 18, par: 5, sa: 5, sb: 5, w: "halved" },
  ]
  const { error: hErr } = await admin.from("hole_results").insert(
    holes.map(h => ({
      match_id: m1.id,
      hole_number: h.hole,
      strokes_a: h.sa,
      strokes_b: h.sb,
      winner: h.w,
      stroke_advantage: "none",
    })),
  )
  if (hErr) throw hErr

  // 7) Active Doubles Match (Reviewer + Lena vs Sam + Tom) — front 9 gespielt
  const { data: m2, error: m2Err } = await admin
    .from("matches")
    .insert({
      tournament_id: tournamentId,
      type: "doubles",
      team_a_player1_id: reviewerPlayer.id,
      team_a_player2_id: lenaPlayer.id,
      team_b_player1_id: samPlayer.id,
      team_b_player2_id: tomPlayer.id,
      status: "active",
      visibility: "public",
    })
    .select("id")
    .single()
  if (m2Err || !m2?.id) throw m2Err ?? new Error("match2_insert_failed")

  const front9: Hole[] = [
    { hole: 1, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 2, par: 4, sa: 5, sb: 4, w: "B" },
    { hole: 3, par: 3, sa: 3, sb: 3, w: "halved" },
    { hole: 4, par: 5, sa: 5, sb: 6, w: "A" },
    { hole: 5, par: 4, sa: 4, sb: 4, w: "halved" },
    { hole: 6, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 7, par: 3, sa: 4, sb: 3, w: "B" },
    { hole: 8, par: 5, sa: 5, sb: 5, w: "halved" },
    { hole: 9, par: 4, sa: 4, sb: 5, w: "A" },
  ]
  await admin.from("hole_results").insert(
    front9.map(h => ({
      match_id: m2.id,
      hole_number: h.hole,
      strokes_a: h.sa,
      strokes_b: h.sb,
      winner: h.w,
      stroke_advantage: "none",
    })),
  )

  // 8) Match-Kommentare (zeigt social layer + user generated content)
  const comments = [
    "Eagle auf der 4 — was für ein Drive!",
    "Wäre auf der 11 fast eingeschlafen, aber Lena hat den Putt versenkt.",
    "Großer Kampf. GG WP 🤝",
  ]
  await admin.from("match_comments").insert(
    comments.map(body => ({
      match_id: m1.id,
      user_id: userId,
      body,
      hidden: false,
      report_count: 0,
    })),
  )

  // 9) Match-Reaktionen (Like vom Reviewer auf das Finished-Match)
  await admin.from("match_reactions").insert({
    match_id: m1.id,
    user_id: userId,
    emoji: "❤️",
  })

  return true
}
