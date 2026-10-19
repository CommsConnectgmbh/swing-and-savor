// support-reply — authenticated user adds a message to their OWN ticket (verify_jwt: true).
// Re-opens a resolved ticket back to in_progress, notifies Slack, mirrors comment to Linear.
import {
  cors, json, serviceClient, getSecrets, userFromRequest,
  slackPost, linearAddComment,
} from "./support.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const svc = serviceClient();
  const user = await userFromRequest(svc, req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { ticket_id?: string; message?: string };
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const ticketId = (payload.ticket_id ?? "").trim();
  const message = (payload.message ?? "").trim().slice(0, 5000);
  if (!ticketId || !message) return json({ error: "ticket_id and message required" }, 400);

  // Ownership check — service role read, but filtered to this user.
  const { data: ticket } = await svc.from("support_tickets")
    .select("id,user_id,subject,status,linear_issue_id")
    .eq("id", ticketId).eq("user_id", user.id).single();
  if (!ticket) return json({ error: "not found" }, 404);

  await svc.from("support_ticket_messages").insert({
    ticket_id: ticket.id, author: "user", body: message,
  });

  // A user reply on a resolved/waiting ticket moves it back into the queue.
  if (ticket.status === "resolved" || ticket.status === "waiting_user") {
    await svc.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket.id);
  }

  const secrets = await getSecrets(svc);
  const appLabel = secrets.app_label || secrets.app_key || "App";

  try {
    if (ticket.linear_issue_id) {
      await linearAddComment(secrets, ticket.linear_issue_id,
        `💬 **Antwort vom Nutzer** (${user.email ?? user.id}):\n\n${message}`);
    }
  } catch (_e) { /* ignore */ }

  await slackPost(secrets,
    `💬 Antwort im Ticket · *${appLabel}* · ${ticket.subject}\n>${message.slice(0, 280)}`);

  return json({ ok: true }, 200);
});
