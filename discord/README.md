# Swing & Savor — Discord Setup

Idempotenter Server-Builder. Re-runs sind safe.

## Was du in Discord machst (einmalig)

1. **Server erstellen** → Name `Swing & Savor`, Community-Mode an (Server Settings → Enable Community).
2. **Developer Portal** → https://discord.com/developers/applications → "New Application" → `Swing & Savor`.
3. **Bot-Tab** → "Reset Token" → Token kopieren.
4. **Bot einladen** mit dem Link (CLIENT_ID einsetzen, Permissions=8 = Admin während Setup):
   ```
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot&permissions=8
   ```
5. **Guild-ID kopieren**: Discord → Server-Settings → Widget → Server-ID (oder Dev-Mode an → Rechtsklick auf Server-Icon → "Copy Server ID").

## Setup

```bash
cd /Volumes/Code/Projects/swing-and-savor/discord
cp .env.example .env
# .env mit DISCORD_BOT_TOKEN + DISCORD_GUILD_ID + DISCORD_CLIENT_ID befüllen
npm install
npm run check-perms   # prüft ob Bot Admin-Perms hat
npm run setup         # legt Rollen, Kategorien, Channels, Webhooks, Invite an
```

Output enthält `DISCORD_INVITE_URL` + Webhook-URLs für `.env.shared`.

## Was angelegt wird

**Kategorien (5):** 📣 START HIER · 💬 COMMUNITY · ⛳ TURNIERE · 💡 FEEDBACK · 🔒 TEAM (privat)

**Text-Channels (18):** willkommen, regeln, ankündigungen, roadmap, general, vorstellen, offtopic, cups, leaderboards, fotos-vom-platz, 19th-hole, platz-talk, features, bugs, faq, beta-testing, ops, metrics

**Voice (2):** 🔊 Clubhouse, 🔊 Tee-Box

**Rollen (10):** 🏆 Organisator, 🛠 Team, 🛡 Moderator, 🤖 Bots, 🏅 Champion, ⛳ Aktiver Spieler, 🌱 Rookie, 🍷 Sponsor, 📣 Turnier-Pings, 🧪 Beta Tester

**Locks:** 📢-ankündigungen, 🤝-regeln, 📋-roadmap → read-only für @everyone, nur Staff postet.

**Webhooks:** `🏆-cups` und `📊-leaderboards` bekommen je einen Webhook für App-Integration.

## Nach dem Setup

1. Bot-Rolle in der Rollenliste **über** alle anderen Rollen ziehen (sonst kann er später Spieler nicht promoten).
2. Bot-Perms im Server-Settings auf Minimum reduzieren (Send Messages, Manage Webhooks, Embed Links) — Admin nur für Initial-Setup nötig.
3. Rainer → 🏆 Organisator Rolle zuweisen.
4. (Optional) Server-Icon = `swing-and-savor/logo.png`, Banner.
