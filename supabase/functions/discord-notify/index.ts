import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WEBHOOK_CUPS = Deno.env.get("DISCORD_WEBHOOK_CUPS") ?? "";
const WEBHOOK_LEADERBOARDS = Deno.env.get("DISCORD_WEBHOOK_LEADERBOARDS") ?? "";
const SHARED_SECRET = Deno.env.get("DISCORD_NOTIFY_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = "https://app.swingandsavor.at";
const SITE_URL = "https://swingandsavor.at";
const DEALBUDDY_URL = "https://deal-buddy.app";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

async function postEmbed(url: string, embed: Record<string, unknown>, content?: string) {
  const body: Record<string, unknown> = { embeds: [embed] };
  if (content) body.content = content;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook ${res.status}: ${text}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const auth = req.headers.get("x-webhook-secret") ?? "";
  if (!SHARED_SECRET || auth !== SHARED_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: { event?: string; tournament?: Record<string, any> };
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = payload.event;
  const t = payload.tournament;
  if (!event || !t) {
    return new Response("missing event or tournament", { status: 400 });
  }

  if (t.visibility && t.visibility !== "public") {
    return new Response(JSON.stringify({ skipped: "non-public" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const publicCupUrl = t.invite_code ? `${SITE_URL}/c/${t.invite_code}` : SITE_URL;

  try {
    if (event === "tournament_created") {
      const embed: Record<string, unknown> = {
        title: `🏆 New cup: ${t.name}`,
        url: publicCupUrl,
        color: 0x166534,
        fields: [
          { name: "Date", value: fmtDate(t.date), inline: true },
          { name: "Teams", value: `${t.team_a_name} vs ${t.team_b_name}`, inline: true },
          { name: "​", value: `🌿 **DE** · Neuer Cup live — [Cup ansehen](${publicCupUrl})\n🇬🇧 **EN** · New cup is live — [view cup](${publicCupUrl})` },
        ],
        footer: { text: `Sign up in the app · ${APP_URL}` },
        timestamp: new Date().toISOString(),
      };
      if (t.description) (embed as any).description = t.description;
      await postEmbed(WEBHOOK_CUPS, embed);
    } else if (event === "tournament_finished") {
      const headers = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      };
      const matchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/matches?tournament_id=eq.${t.id}&status=eq.finished&select=winner`,
        { headers },
      );
      const matches: Array<{ winner: string }> = await matchRes.json();
      let a = 0, b = 0;
      for (const m of matches) {
        if (m.winner === "A") a += 1;
        else if (m.winner === "B") b += 1;
        else if (m.winner === "halved") { a += 0.5; b += 0.5; }
      }
      const winnerText = a > b
        ? `🏆 **${t.team_a_name}**`
        : b > a
          ? `🏆 **${t.team_b_name}**`
          : `🤝 **Tied**`;
      const scoreA = Number.isInteger(a) ? a.toString() : a.toFixed(1);
      const scoreB = Number.isInteger(b) ? b.toString() : b.toFixed(1);
      const embed = {
        title: `📊 Cup finished: ${t.name}`,
        url: publicCupUrl,
        color: 0xe6b800,
        description: `**Final score**\n${t.team_a_name} ${scoreA} — ${scoreB} ${t.team_b_name}\n\n${winnerText}`,
        fields: [
          { name: "Date", value: fmtDate(t.date), inline: true },
          { name: "Matches played", value: matches.length.toString(), inline: true },
          { name: "​", value: `[📄 Recap](${publicCupUrl}) · [💰 Side-bet on the rematch](${DEALBUDDY_URL})` },
        ],
        footer: { text: APP_URL },
        timestamp: new Date().toISOString(),
      };
      await postEmbed(WEBHOOK_LEADERBOARDS, embed);
    } else {
      return new Response(`unknown event: ${event}`, { status: 400 });
    }
  } catch (e) {
    console.error("[discord-notify]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
