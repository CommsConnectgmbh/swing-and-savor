import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), ".env"),
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const c = new Client({ intents: [GatewayIntentBits.Guilds] });

const RULES = `**Swing & Savor — Community-Regeln**

1. **Respekt zuerst.** Keine Beleidigungen, kein Rassismus, keine Diskriminierung.
2. **Spam & Werbung** ohne Absprache mit Staff → Mute. Eigene Cups und Spots im passenden Channel teilen.
3. **Fair Play.** Score-Manipulation oder Sandbagging fliegt sofort raus.
4. **NSFW & Politik gehören nicht hierher.** Hier geht es um Golf, Essen und Trinken.
5. **Privatsphäre.** Keine Fotos anderer Spieler ohne deren OK.
6. **DSGVO.** Personenbezogene Daten (Adressen, Telefonnummern) nicht öffentlich posten.
7. **Bei Streit:** an einen :shield: Moderator wenden — nicht selbst eskalieren.
8. **Discord-TOS gelten zusätzlich.** https://discord.com/terms

Bei Regelverstoß: Warnung → Mute → Kick → Ban.
`;

const WELCOME = `:wave: **Willkommen bei Swing & Savor!**

Hier vernetzen sich Spieler unserer Golf-Cups — vor, während und nach der Runde.

**Was du hier findest:**
:trophy: **#cups** — kommende Turniere & Anmeldung
:bar_chart: **#leaderboards** — Live-Scores aus der App (automatisch)
:camera_with_flash: **#fotos-vom-platz** — deine besten Shots
:wine_glass: **#19th-hole** — Food, Wein, Spots nach der Runde
:golf: **#platz-talk** — Course-Beta, Tee-Box-Tipps

**App & Web:**
- App: https://swingandsavor.at
- Cup-Anmeldung in der App

**Erste Schritte:**
1. Lies kurz die :handshake: **#regeln**
2. Stell dich vor in :wave: **#vorstellen**
3. Pick deinen nächsten Cup in :trophy: **#cups**

Have a good walk. :golf:
`;

const ROADMAP = `**Swing & Savor — Roadmap**

:white_check_mark: **Geliefert**
- PWA live auf swingandsavor.at
- Cup-Anmeldung + Scoring
- Leaderboards
- Native iOS/Android (Capacitor)
- Discord-Community :tada:

:construction: **In Arbeit**
- Auto-Posts in #leaderboards bei finalem Cup
- Foto-Feed direkt aus der App in #fotos-vom-platz
- Sponsoren-Slots pro Cup

:crystal_ball: **Next Up**
- Spieler-Profile mit Statistik
- Multi-Course-Support
- Side-Bets pro Loch

Updates landen hier sobald sie live sind.
`;

const FAQ = `**FAQ — Swing & Savor**

**Was ist Swing & Savor?**
Eine Golf-Turnier-Plattform: anmelden, spielen, scoren, geniessen. Web + iOS + Android.

**Wo finde ich die App?**
https://swingandsavor.at (PWA — installierbar auf dem Homescreen). Native-Apps folgen in den Stores.

**Wie melde ich mich für einen Cup an?**
In der App → Cups → Cup auswählen → Anmelden. Updates landen hier in :trophy: **#cups**.

**Wie funktionieren die Leaderboards?**
Scores werden in der App live geführt. Sobald ein Cup beendet ist, postet der Bot das Ergebnis in :bar_chart: **#leaderboards**.

**Kann ich eigene Cups erstellen?**
Aktuell auf Anfrage — schreib einem :shield: Organisator. Self-Service-Cups kommen.

**Wie melde ich einen Bug?**
:lady_beetle: **#bugs** — Schritte, Screenshot, Gerät. Je konkreter desto schneller gefixt.

**Wie werde ich Sponsor?**
DM an einen :trophy: Organisator. Sponsor-Slots pro Cup mit eigener :wine_glass: **Sponsor**-Rolle.

**Datenschutz?**
Wir speichern nur was nötig ist: Account + Score-History. Keine Tracking-Ads. Details im Impressum/DSGVO auf swingandsavor.at.
`;

c.once("clientReady", async () => {
  const guild = await c.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  const find = (name) =>
    guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name === name
    );

  const posts = [
    ["🤝-regeln", RULES],
    ["📢-ankündigungen", WELCOME],
    ["📋-roadmap", ROADMAP],
    ["🙋-faq", FAQ],
    ["👋-willkommen", WELCOME],
  ];

  for (const [name, content] of posts) {
    const ch = find(name);
    if (!ch) {
      console.log("skip (no channel):", name);
      continue;
    }
    // skip if bot already posted in this channel (idempotent)
    const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    const already = recent?.find((m) => m.author.id === c.user.id);
    if (already) {
      console.log("skip (already posted):", name);
      continue;
    }
    await ch.send({ content });
    console.log("posted:", name);
  }

  await c.destroy();
});

c.login(TOKEN);
