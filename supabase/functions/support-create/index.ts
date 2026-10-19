// support-create — creates a ticket for the authenticated user (verify_jwt: true).
// Writes ticket + first message (service role), notifies Slack, mirrors to Linear if enabled.
import {
  cors, json, serviceClient, getSecrets, userFromRequest,
  slackPost, linearCreateIssue, STATUS_LABELS_DE,
} from "./support.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const svc = serviceClient();
  const user = await userFromRequest(svc, req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { subject?: string; message?: string; context?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const subject = (payload.subject ?? "").trim().slice(0, 200);
  const message = (payload.message ?? "").trim().slice(0, 5000);
  if (!subject || !message) return json({ error: "subject and message required" }, 400);

  const secrets = await getSecrets(svc);
  const appKey = secrets.app_key || "app";
  const appLabel = secrets.app_label || appKey;
  const context = { ...(payload.context ?? {}), email: user.email };

  const { data: ticket, error } = await svc.from("support_tickets").insert({
    user_id: user.id, app: appKey, subject, context,
  }).select("id").single();
  if (error || !ticket) return json({ error: "insert failed" }, 500);

  await svc.from("support_ticket_messages").insert({
    ticket_id: ticket.id, author: "user", body: message,
  });

  // Mirror to Linear (no-op when not configured)
  try {
    const issue = await linearCreateIssue(secrets, {
      title: `[${appLabel}] ${subject}`,
      description:
        `**Von:** ${user.email ?? user.id}\n\n${message}\n\n` +
        `---\n_Support-Ticket ${ticket.id} · App: ${appLabel}_\n` +
        "```json\n" + JSON.stringify(context, null, 2) + "\n```",
    });
    if (issue) {
      await svc.from("support_tickets")
        .update({ linear_issue_id: issue.id, linear_identifier: issue.identifier })
        .eq("id", ticket.id);
    }
  } catch (_e) { /* Linear must never block ticket creation */ }

  await slackPost(
    secrets,
    `🎫 Neues Support-Ticket · *${appLabel}*`,
    [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎫 *Neues Support-Ticket* · *${appLabel}*\n*${subject}*\n>${message.slice(0, 280)}` +
          `\n_von ${user.email ?? user.id} · Status: ${STATUS_LABELS_DE.received}_`,
      },
    }],
  );

  return json({ id: ticket.id, status: "received" }, 201);
});
