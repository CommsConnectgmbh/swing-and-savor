import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, GatewayIntentBits } from "discord.js";

// Secrets zur Laufzeit aus dem Tresor (roloff-secrets), Zuordnung aus dem env-manifest.
(await import((await import("node:os")).homedir() + "/.local/lib/roloff/secrets.mjs")).loadSecrets({
  dir: dirname(fileURLToPath(import.meta.url)),
});

const c = new Client({ intents: [GatewayIntentBits.Guilds] });
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!GUILD_ID) {
  console.error("DISCORD_GUILD_ID missing im Tresor (roloff-secrets)");
  process.exit(1);
}

c.once("clientReady", async () => {
  const guild = await c.guilds.fetch(GUILD_ID);
  const me = await guild.members.fetchMe();
  const perms = me.permissions.toArray();
  const need = [
    "ManageChannels",
    "ManageRoles",
    "ManageGuild",
    "ManageWebhooks",
    "CreateInstantInvite",
    "SendMessages",
    "ViewChannel",
    "Administrator",
  ];
  console.log("Guild:", guild.name, "(" + guild.id + ")");
  console.log("Bot user:", c.user.tag, c.user.id);
  console.log("Highest role:", me.roles.highest.name, "pos", me.roles.highest.position);
  console.log("Has perms:");
  for (const p of need) console.log("  ", p, perms.includes(p));
  console.log("\nApp invite URL (Admin, for setup):");
  console.log(
    `https://discord.com/api/oauth2/authorize?client_id=${c.user.id}&permissions=8&scope=bot`
  );
  await c.destroy();
});

c.login(process.env.DISCORD_BOT_TOKEN);
