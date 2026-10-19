import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("invite");
  if (!inviteCode || !/^[A-Za-z0-9_-]{4,32}$/.test(inviteCode)) {
    return new Response(JSON.stringify({ error: "invalid invite" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cup, error } = await admin
    .from("tournaments")
    .select("id, name, date, status, team_a_name, team_b_name, description, visibility, invite_code, cover_url, location_name, format, rules_md, entry_conditions, max_participants, join_mode, promoted_until, promo_tier")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!cup) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: matches } = await admin
    .from("matches")
    .select("winner, status, type")
    .eq("tournament_id", cup.id);

  let scoreA = 0, scoreB = 0, finished = 0;
  for (const m of matches ?? []) {
    if (m.status !== "finished") continue;
    finished++;
    if (m.winner === "A") scoreA += 1;
    else if (m.winner === "B") scoreB += 1;
    else if (m.winner === "halved") { scoreA += 0.5; scoreB += 0.5; }
  }

  return new Response(JSON.stringify({
    ok: true,
    cup: {
      id: cup.id,
      name: cup.name,
      date: cup.date,
      status: cup.status,
      team_a_name: cup.team_a_name,
      team_b_name: cup.team_b_name,
      description: cup.description,
      visibility: cup.visibility,
      invite_code: cup.invite_code,
      cover_url: cup.cover_url,
      location_name: cup.location_name,
      format: cup.format,
      rules_md: cup.rules_md,
      entry_conditions: cup.entry_conditions || {},
      max_participants: cup.max_participants,
      join_mode: cup.join_mode || 'invite_only',
      promoted_until: cup.promoted_until,
      promo_tier: cup.promo_tier,
      score_a: scoreA,
      score_b: scoreB,
      matches_total: matches?.length ?? 0,
      matches_finished: finished,
    },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
});
