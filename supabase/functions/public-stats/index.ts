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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const [courses, players, matches, cups, countries] = await Promise.all([
    admin.from("courses").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("matches").select("id", { count: "exact", head: true }).eq("status", "finished"),
    admin.from("tournaments").select("id", { count: "exact", head: true }),
    admin.from("courses").select("country").not("country", "is", null),
  ]);

  const distinctCountries = new Set<string>();
  for (const row of countries.data ?? []) {
    if (row?.country) distinctCountries.add(String(row.country));
  }

  return new Response(JSON.stringify({
    courses: courses.count ?? 0,
    players: players.count ?? 0,
    matches: matches.count ?? 0,
    cups: cups.count ?? 0,
    countries: distinctCountries.size,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
});
