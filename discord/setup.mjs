#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), ".env"),
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN) {
  console.error("DISCORD_BOT_TOKEN missing in discord/.env");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("DISCORD_GUILD_ID missing in discord/.env");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const ROLE_DEFS = [
  { name: "🏆 Organisator", color: 0x166534, hoist: true, mentionable: true },
  { name: "🛠 Team", color: 0x15803d, hoist: true, mentionable: true },
  { name: "🛡 Moderator", color: 0x3b82f6, hoist: true, mentionable: true },
  { name: "🤖 Bots", color: 0x6b7280, hoist: false, mentionable: false },
  { name: "🏅 Champion", color: 0xe6b800, hoist: true, mentionable: false },
  { name: "⛳ Aktiver Spieler", color: 0x22c55e, hoist: false, mentionable: false },
  { name: "🌱 Rookie", color: 0x10b981, hoist: false, mentionable: false },
  { name: "🍷 Sponsor", color: 0xb91c1c, hoist: true, mentionable: true },
  { name: "📣 Turnier-Pings", color: 0xfde047, mentionable: true },
  { name: "🧪 Beta Tester", color: 0xec4899, mentionable: true },
];

const CATEGORIES = [
  "📣 START HIER",
  "💬 COMMUNITY",
  "⛳ TURNIERE",
  "💡 FEEDBACK",
  "🔒 TEAM",
];

// [name, category, topic]
const TEXT_CHANNELS = [
  [
    "👋-willkommen",
    "📣 START HIER",
    "Willkommen bei Swing & Savor — start hier. Regeln lesen, vorstellen, ersten Cup picken.",
  ],
  [
    "🤝-regeln",
    "📣 START HIER",
    "Die Regeln der Community. Kurz, fair, bindend.",
  ],
  [
    "📢-ankündigungen",
    "📣 START HIER",
    "Offizielle Updates vom Team — nur Staff schreibt hier.",
  ],
  [
    "📋-roadmap",
    "📣 START HIER",
    "Was kommt als nächstes: Cups, Features, Meilensteine.",
  ],
  [
    "💬-general",
    "💬 COMMUNITY",
    "Hauptchat. Alles was sonst nirgends reinpasst.",
  ],
  [
    "👋-vorstellen",
    "💬 COMMUNITY",
    "Neu hier? Sag kurz Hallo — wer bist du, woher kommst du, dein Heimatclub?",
  ],
  [
    "🎉-offtopic",
    "💬 COMMUNITY",
    "Memes, Smalltalk, random stuff.",
  ],
  [
    "🏆-cups",
    "⛳ TURNIERE",
    "Kommende und laufende Turniere. Anmeldung + Updates.",
  ],
  [
    "📊-leaderboards",
    "⛳ TURNIERE",
    "Live-Scores und Ergebnisse — automatisch gepostet, wenn ein Cup final ist.",
  ],
  [
    "📸-fotos-vom-platz",
    "⛳ TURNIERE",
    "Deine besten Shots, Sonnenuntergänge auf 18, Group-Pics. Zeig her.",
  ],
  [
    "🍷-19th-hole",
    "⛳ TURNIERE",
    "Nach der Runde: Food, Wein, Spots, Empfehlungen.",
  ],
  [
    "⛳-platz-talk",
    "⛳ TURNIERE",
    "Welcher Platz, welche Tee-Box, welcher Wind — Course-Specific Talk.",
  ],
  [
    "💡-features",
    "💡 FEEDBACK",
    "Was fehlt dir in der App? Hier vorschlagen — je konkreter desto besser.",
  ],
  [
    "🐛-bugs",
    "💡 FEEDBACK",
    "Bug gefunden? Hier melden: Schritte, Screenshot, Gerät.",
  ],
  [
    "🙋-faq",
    "💡 FEEDBACK",
    "Häufige Fragen. Erst hier gucken, dann fragen.",
  ],
  [
    "🧪-beta-testing",
    "💡 FEEDBACK",
    "Beta-Builds, Testing-Anleitungen, Feedback.",
  ],
  ["🛠-ops", "🔒 TEAM", "Internal team ops."],
  ["📊-metrics", "🔒 TEAM", "Cup-Metriken, Signups, DAU."],
];

const VOICE_CHANNELS = [
  ["🔊 Clubhouse", "💬 COMMUNITY"],
  ["🔊 Tee-Box", "⛳ TURNIERE"],
];

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    await guild.roles.fetch();

    // --- ROLES ---
    const roles = {};
    for (const def of ROLE_DEFS) {
      let role = guild.roles.cache.find((r) => r.name === def.name);
      if (!role) {
        role = await guild.roles.create(def);
        console.log("role+", def.name);
      }
      roles[def.name] = role;
    }

    // --- CATEGORIES ---
    const cats = {};
    for (const name of CATEGORIES) {
      let cat = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === name
      );
      if (!cat) {
        const opts = { name, type: ChannelType.GuildCategory };
        if (name === "🔒 TEAM") {
          opts.permissionOverwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: roles["🏆 Organisator"].id,
              allow: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: roles["🛠 Team"].id,
              allow: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: roles["🛡 Moderator"].id,
              allow: [PermissionFlagsBits.ViewChannel],
            },
          ];
        }
        cat = await guild.channels.create(opts);
        console.log("cat+", name);
      }
      cats[name] = cat;
    }

    // --- TEXT CHANNELS ---
    const channels = {};
    for (const [name, catName, topic] of TEXT_CHANNELS) {
      let ch = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name === name
      );
      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: cats[catName].id,
          topic,
        });
        console.log("ch+", name);
      } else if (ch.parentId !== cats[catName].id || ch.topic !== topic) {
        await ch.edit({ parent: cats[catName].id, topic });
        console.log("ch~", name);
      }
      channels[name] = ch;
    }

    // --- WRITE PERMISSIONS on announcements/regeln/roadmap (staff-only writes) ---
    const staffWriteOnly = ["📢-ankündigungen", "🤝-regeln", "📋-roadmap"];
    for (const cname of staffWriteOnly) {
      const ch = channels[cname];
      if (!ch) continue;
      await ch.permissionOverwrites.set([
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: roles["🏆 Organisator"].id,
          allow: [PermissionFlagsBits.SendMessages],
        },
        {
          id: roles["🛠 Team"].id,
          allow: [PermissionFlagsBits.SendMessages],
        },
        {
          id: roles["🛡 Moderator"].id,
          allow: [PermissionFlagsBits.SendMessages],
        },
      ]);
      console.log("locked", cname);
    }

    // --- VOICE CHANNELS ---
    for (const [name, catName] of VOICE_CHANNELS) {
      let ch = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildVoice && c.name === name
      );
      if (!ch) {
        await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: cats[catName].id,
        });
        console.log("voice+", name);
      }
    }

    // --- WEBHOOKS for app integration ---
    const webhookTargets = [
      ["🏆-cups", "swing-savor-cups"],
      ["📊-leaderboards", "swing-savor-leaderboards"],
    ];
    const webhooks = {};
    for (const [cname, hookName] of webhookTargets) {
      const ch = channels[cname];
      if (!ch) continue;
      const existing = await ch.fetchWebhooks();
      let hook = existing.find((h) => h.name === hookName);
      if (!hook) {
        hook = await ch.createWebhook({ name: hookName });
        console.log("webhook+", hookName);
      }
      webhooks[hookName] = hook.url;
    }

    // --- INVITE ---
    let inviteUrl;
    try {
      const welcome = channels["👋-willkommen"] || channels["💬-general"];
      const existing = await guild.invites.fetch();
      let inv = existing.find(
        (i) => i.maxAge === 0 && i.inviterId === client.user.id && !i.temporary
      );
      if (!inv) {
        inv = await welcome.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: false,
          reason: "Permanent public invite",
        });
      }
      inviteUrl = inv.url;
    } catch (e) {
      console.error("invite err:", e.message);
    }

    console.log("\n=== ENV-Updates für .env.shared ===");
    console.log("DISCORD_INVITE_URL=" + (inviteUrl || "(failed)"));
    for (const [name, url] of Object.entries(webhooks)) {
      const key = name.replace(/-/g, "_").toUpperCase();
      console.log(`DISCORD_WEBHOOK_${key}=${url}`);
    }
    console.log("\nDONE");
  } catch (e) {
    console.error("setup failed:", e);
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
});

client.login(TOKEN);
