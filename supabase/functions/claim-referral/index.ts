import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { ref_code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const refCode = (body.ref_code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(refCode)) {
    return new Response(JSON.stringify({ error: "invalid ref_code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Service-role client for writes that bypass RLS
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find inviter by ref_code
  const { data: inviter, error: inviterErr } = await admin
    .from("profiles")
    .select("id, ref_code")
    .eq("ref_code", refCode)
    .maybeSingle();
  if (inviterErr || !inviter) {
    return new Response(JSON.stringify({ error: "unknown ref_code" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (inviter.id === user.id) {
    return new Response(JSON.stringify({ skipped: "self" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Insert; unique(invitee_id) means second calls are silently ignored
  const { error: insErr } = await admin
    .from("referrals")
    .insert({
      inviter_id: inviter.id,
      invitee_id: user.id,
      ref_code: refCode,
      status: "pending",
    });

  if (insErr && !String(insErr.message).match(/duplicate|unique/i)) {
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, inviter_id: inviter.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
