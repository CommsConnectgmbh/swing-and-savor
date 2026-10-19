// support-linear-webhook — inbound Linear events (verify_jwt: false; HMAC-verified).
// Maps Linear issue state -> user-facing status, and mirrors support comments back
// into the in-app thread. Dormant until linear_webhook_secret is seeded.
import {
  cors, json, serviceClient, getSecrets,
  mapLinearState, verifyLinearSignature,
} from "./support.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const svc = serviceClient();
  const secrets = await getSecrets(svc);
  const secret = secrets.linear_webhook_secret || "";
  const raw = await req.text();
  const sig = req.headers.get("linear-signature") ?? "";

  if (!secret) return json({ error: "linear not configured" }, 503);
  if (!(await verifyLinearSignature(secret, raw, sig))) return json({ error: "bad signature" }, 401);

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }

  const type = evt.type;            // "Issue" | "Comment" | ...
  const action = evt.action;        // "create" | "update" | "remove"
  const data = evt.data ?? {};

  if (type === "Issue") {
    const issueId = data.id;
    const stateType = data.state?.type;
    if (issueId && stateType) {
      const status = mapLinearState(stateType);
      await svc.from("support_tickets").update({ status }).eq("linear_issue_id", issueId);
    }
    return json({ ok: true });
  }

  if (type === "Comment" && action === "create") {
    const issueId = data.issue?.id;
    const body: string = data.body ?? "";
    const commentId: string = data.id;
    // Skip our own echoed user-replies (we prefix them) to avoid loops.
    const isOurEcho = body.startsWith("💬 **Antwort vom Nutzer**");
    if (issueId && body && commentId && !isOurEcho) {
      const { data: ticket } = await svc.from("support_tickets")
        .select("id,status").eq("linear_issue_id", issueId).single();
      if (ticket) {
        // external_id unique index makes this idempotent on retries
        await svc.from("support_ticket_messages").insert({
          ticket_id: ticket.id, author: "support", body, external_id: `linear:${commentId}`,
        });
        if (ticket.status === "received") {
          await svc.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket.id);
        }
      }
    }
    return json({ ok: true });
  }

  return json({ ok: true });
});
