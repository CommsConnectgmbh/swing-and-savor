// reviewer-bypass — Apple + Google Reviewer Login ohne Mailbox-Zugriff.
//
// Sicherheit basiert auf zwei Faktoren:
//   1. Hardcoded Email — nur apple-review@swingandsavor.at oder
//      play-review@swingandsavor.at wird akzeptiert.
//   2. Hardcoded 8-stelliger Code — nur dieser eine Wert öffnet die Tür.
// Jeder andere Zugriffsversuch endet in 403.
//
// Nach erfolgreicher Auth wird der Reviewer-Account idempotent mit Demo-
// Content geseedet (Profile + Friends + Turnier + Matches + DM-Konversationen
// mit anderen Demo-Usern), damit Apple alle Features inkl. Safety-Mechanismen
// (Block + Report) testen kann. Guideline 1.2 / 2.1(a) Re-Submit 2026-05-27.
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

const DEMO_TOURNAMENT_NAME = "🍃 Apple Review Demo Cup"

// Demo-User die Chat-Partner werden (echte auth.users + profiles)
const CHAT_PARTNERS = [
  { email: "lena.eagle@demo.swingandsavor.at",   handle: "lena_eagle",  display: "Lena Eagle",  hcp: 11.8, club: "GC München-Riedhof" },
  { email: "sam.birdie@demo.swingandsavor.at",   handle: "sam_birdie",  display: "Sam Birdie",  hcp: 16.2, club: "Royal Demo GC"      },
  { email: "tom.putter@demo.swingandsavor.at",   handle: "tom_putter",  display: "Tom Putter",  hcp: 19.0, club: "Beuerberg"          },
]

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

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (error || !data?.properties?.hashed_token || !data?.user?.id) {
    return new Response(JSON.stringify({ error: error?.message ?? "no_link" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

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

// Idempotenter Seed.
async function ensureDemoContent(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<boolean> {
  const isApple = email.startsWith("apple-")
  const handle  = isApple ? "apple_reviewer" : "play_reviewer"
  const display = isApple ? "Apple Reviewer" : "Play Reviewer"

  // ── 1) Reviewer-Profile ───────────────────────────────────────────
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

  // ── 2) Chat-Partner Auth-Users + Profiles (idempotent) ────────────
  const partnerIds = await Promise.all(
    CHAT_PARTNERS.map(p => ensurePartner(admin, p)),
  )
  const [lenaId, samId, tomId] = partnerIds

  // ── 3) Friendships zwischen Reviewer und allen Demo-Usern ─────────
  for (const partnerId of partnerIds) {
    await upsertFriendship(admin, userId, partnerId)
  }

  // ── 4) Demo-Chats ─────────────────────────────────────────────────
  await ensureConversation(admin, userId, lenaId, [
    { sender: lenaId, body: "Servus! Hast du Lust auf eine Runde am Samstag in Riedhof?" },
    { sender: userId, body: "Sehr gerne. 9 Uhr Tee?" },
    { sender: lenaId, body: "Passt. Magst du 9 Löcher oder gleich die volle Runde?" },
    { sender: userId, body: "Volle Runde, gerne Match Play. Bring Sam mit, dann sind wir zu dritt." },
    { sender: lenaId, body: "Sehr gut, ich frag ihn an. Bis Samstag! 🏌️" },
  ])

  await ensureConversation(admin, userId, samId, [
    { sender: samId,  body: "Hey, hast du den letzten Eagle gesehen? 😉" },
    { sender: userId, body: "Klar, Bahn 4 — Drive über die Bäume, dann mit dem 6er auf 3 Meter." },
    { sender: samId,  body: "Heftig. Revanche nächstes Wochenende?" },
    { sender: userId, body: "Lena will Samstag — kommst du mit?" },
    { sender: samId,  body: "Bin dabei. Doppel oder Singles?" },
  ])

  // ── 5) Demo-Tournament (nur falls noch nicht da) ──────────────────
  const { data: existing } = await admin
    .from("tournaments")
    .select("id")
    .eq("owner_id", userId)
    .eq("name", DEMO_TOURNAMENT_NAME)
    .limit(1)
    .maybeSingle()
  if (existing?.id) return false

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
      description: "Demo-Turnier für den App-Review. Zeigt Match-Tracking, Live-Scoring, Stroke- und Match-Play, sowie Social-Features (Kommentare/Reaktionen).",
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

  const playersPayload = [
    { tournament_id: tournamentId, name: reviewerDisplay, handicap: 14.3, team: "A", profile_id: userId },
    { tournament_id: tournamentId, name: "Lena Eagle",    handicap: 11.8, team: "A", profile_id: lenaId },
    { tournament_id: tournamentId, name: "Sam Birdie",    handicap: 16.2, team: "B", profile_id: samId  },
    { tournament_id: tournamentId, name: "Tom Putter",    handicap: 19.0, team: "B", profile_id: tomId  },
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

  type Hole = { hole: number; par: number; sa: number; sb: number; w: "A"|"B"|"halved" }
  const holes: Hole[] = [
    { hole:  1, par: 4, sa: 4, sb: 5, w: "A" },
    { hole:  2, par: 4, sa: 5, sb: 5, w: "halved" },
    { hole:  3, par: 3, sa: 3, sb: 4, w: "A" },
    { hole:  4, par: 5, sa: 4, sb: 5, w: "A" },
    { hole:  5, par: 4, sa: 4, sb: 4, w: "halved" },
    { hole:  6, par: 4, sa: 5, sb: 4, w: "B" },
    { hole:  7, par: 3, sa: 3, sb: 3, w: "halved" },
    { hole:  8, par: 5, sa: 6, sb: 6, w: "halved" },
    { hole:  9, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 10, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 11, par: 4, sa: 5, sb: 4, w: "B" },
    { hole: 12, par: 3, sa: 4, sb: 4, w: "halved" },
    { hole: 13, par: 5, sa: 5, sb: 6, w: "A" },
    { hole: 14, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 15, par: 4, sa: 4, sb: 4, w: "halved" },
    { hole: 16, par: 3, sa: 3, sb: 4, w: "A" },
    { hole: 17, par: 4, sa: 4, sb: 5, w: "A" },
    { hole: 18, par: 5, sa: 5, sb: 5, w: "halved" },
  ]
  await admin.from("hole_results").insert(
    holes.map(h => ({
      match_id: m1.id,
      hole_number: h.hole,
      strokes_a: h.sa,
      strokes_b: h.sb,
      winner: h.w,
      stroke_advantage: "none",
    })),
  )

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

  // Comments — mixed authors zeigen UGC + Safety-Reviewbar
  await admin.from("match_comments").insert([
    { match_id: m1.id, user_id: userId, body: "Eagle auf der 4 — was für ein Drive!" },
    { match_id: m1.id, user_id: samId,  body: "Großer Kampf. GG WP 🤝" },
    { match_id: m1.id, user_id: userId, body: "Revanche nächste Woche?" },
    { match_id: m2.id, user_id: lenaId, body: "Front 9 lief gut für uns. Back 9 schließen wir's." },
    { match_id: m2.id, user_id: tomId,  body: "Wir sind noch dran 😉" },
  ])

  await admin.from("match_reactions").insert([
    { match_id: m1.id, user_id: userId, emoji: "❤️" },
    { match_id: m1.id, user_id: lenaId, emoji: "🔥" },
    { match_id: m2.id, user_id: samId,  emoji: "💪" },
  ])

  return true
}

async function ensurePartner(
  admin: SupabaseClient,
  spec: { email: string; handle: string; display: string; hcp: number; club: string },
): Promise<string> {
  // 1) existiert auth.user schon?
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = list?.users?.find(u => u.email?.toLowerCase() === spec.email.toLowerCase())
  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: spec.email,
      email_confirm: true,
      user_metadata: { demo: true, source: "reviewer-bypass" },
    })
    if (error || !created?.user) throw error ?? new Error(`createUser failed ${spec.email}`)
    user = created.user
  }
  const userId = user.id

  // 2) Profile sicherstellen
  const { data: prof } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
  if (!prof) {
    await admin.from("profiles").insert({
      id: userId,
      handle: spec.handle,
      display_name: spec.display,
      hcp: spec.hcp,
      home_club: spec.club,
    })
  }
  return userId
}

async function upsertFriendship(
  admin: SupabaseClient,
  a: string,
  b: string,
): Promise<void> {
  const [ua, ub] = a < b ? [a, b] : [b, a]
  const { data: existing } = await admin.from("friendships")
    .select("user_a").eq("user_a", ua).eq("user_b", ub).maybeSingle()
  if (existing) return
  await admin.from("friendships").insert({
    user_a: ua,
    user_b: ub,
    status: "accepted",
    requested_by: a,
    responded_at: new Date().toISOString(),
  })
}

async function ensureConversation(
  admin: SupabaseClient,
  a: string,
  b: string,
  messages: Array<{ sender: string; body: string }>,
): Promise<void> {
  const [ua, ub] = a < b ? [a, b] : [b, a]
  let convId: string | null = null
  const { data: existing } = await admin.from("conversations")
    .select("id").eq("user_a", ua).eq("user_b", ub).maybeSingle()
  if (existing) {
    convId = existing.id
    const { count } = await admin.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId)
    if ((count ?? 0) > 0) return // schon Messages drin → fertig
  } else {
    const { data: conv, error } = await admin.from("conversations")
      .insert({ user_a: ua, user_b: ub })
      .select("id").single()
    if (error || !conv?.id) throw error ?? new Error("conv_insert_failed")
    convId = conv.id
  }

  const now = Date.now()
  const rows = messages.map((m, idx) => ({
    conversation_id: convId!,
    sender_id: m.sender,
    body: m.body,
    created_at: new Date(now - (messages.length - idx) * 60_000).toISOString(),
    read_at: m.sender === a ? new Date(now - (messages.length - idx - 1) * 60_000).toISOString() : null,
  }))
  await admin.from("messages").insert(rows)

  await admin.from("conversations")
    .update({ last_message_at: rows[rows.length - 1].created_at })
    .eq("id", convId!)
}
