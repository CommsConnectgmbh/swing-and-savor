// Shared helpers for the support-center edge functions.
// Deployed as ./support.ts alongside each function's index.ts.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Service-role client (full access — used for writes + reading private.app_secrets).
export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export type Secrets = Record<string, string>;

export async function getSecrets(svc: ReturnType<typeof serviceClient>): Promise<Secrets> {
  // support_secrets lives in public with RLS-enabled-no-policy: only the service
  // role (BYPASSRLS) can read it; anon/authenticated are denied.
  const { data, error } = await svc.from("support_secrets").select("key,value");
  if (error) throw new Error("secrets read failed: " + error.message);
  const out: Secrets = {};
  for (const row of data ?? []) out[row.key] = row.value ?? "";
  return out;
}

// Resolve the authenticated user from the caller's JWT (verify_jwt handles validity).
export async function userFromRequest(
  svc: ReturnType<typeof serviceClient>,
  req: Request,
): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

// ---- Slack -----------------------------------------------------------------
export async function slackPost(s: Secrets, text: string, blocks?: unknown[]) {
  const token = s.slack_bot_token;
  const channel = s.slack_channel;
  if (!token || !channel) return; // Slack not configured for this app — skip silently
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text, blocks, unfurl_links: false }),
    });
  } catch (_e) { /* never let Slack break ticket creation */ }
}

// ---- Linear (gated: only runs when linear_api_key + linear_team_id present) -
export function linearEnabled(s: Secrets) {
  return Boolean(s.linear_api_key && s.linear_team_id);
}

async function linearGql(s: Secrets, query: string, variables: unknown) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: s.linear_api_key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const out = await res.json();
  if (out.errors) throw new Error("linear: " + JSON.stringify(out.errors));
  return out.data;
}

export async function linearCreateIssue(
  s: Secrets,
  args: { title: string; description: string },
): Promise<{ id: string; identifier: string } | null> {
  if (!linearEnabled(s)) return null;
  const data = await linearGql(
    s,
    `mutation($teamId:String!,$title:String!,$description:String!){
       issueCreate(input:{teamId:$teamId,title:$title,description:$description}){
         issue{ id identifier }
       }
     }`,
    { teamId: s.linear_team_id, title: args.title, description: args.description },
  );
  const issue = data?.issueCreate?.issue;
  return issue ? { id: issue.id, identifier: issue.identifier } : null;
}

export async function linearAddComment(s: Secrets, issueId: string, body: string) {
  if (!linearEnabled(s)) return;
  await linearGql(
    s,
    `mutation($issueId:String!,$body:String!){
       commentCreate(input:{issueId:$issueId,body:$body}){ success }
     }`,
    { issueId, body },
  );
}

// Linear state.type -> user-facing status
export function mapLinearState(stateType: string): string {
  switch (stateType) {
    case "triage":
    case "backlog":
    case "unstarted":
      return "received";
    case "started":
      return "in_progress";
    case "completed":
      return "resolved";
    case "canceled":
      return "closed";
    default:
      return "received";
  }
}

// HMAC-SHA256 verification of an inbound Linear webhook payload.
export async function verifyLinearSignature(secret: string, rawBody: string, signature: string) {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export const STATUS_LABELS_DE: Record<string, string> = {
  received: "Eingegangen",
  in_progress: "In Bearbeitung",
  waiting_user: "Wartet auf dich",
  resolved: "Gelöst",
  closed: "Geschlossen",
};
