import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), ".env"),
});

const c = new Client({ intents: [GatewayIntentBits.Guilds] });

c.once("clientReady", async () => {
  console.log("Bot:", c.user.tag, "(" + c.user.id + ")");
  console.log("Guilds the bot is in:");
  for (const [id, g] of c.guilds.cache) {
    console.log("  -", g.name, "→", id);
  }
  if (c.guilds.cache.size === 0) {
    console.log("  (none — bot not invited yet)");
    console.log("\nInvite URL:");
    console.log(
      `https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot&permissions=8`
    );
  }
  await c.destroy();
});

c.login(process.env.DISCORD_BOT_TOKEN);
