# Swing & Savor — Finalization Report (2026-05-17)

Abschluss der globalen Push-Session. App, Marketing-Page und Backend sind jetzt
vollständig international, Newsletter-Capture und ASO-Listings ergänzt.

---

## ✅ Heute live gegangen (über diese Session insgesamt)

### Internationalisierung — komplett 5-sprachig

| Sprache | App (PWA) | Marketing-Site | Newsletter-Mail | ASO-Listings |
|---|---|---|---|---|
| 🇬🇧 English | ✅ | ✅ | ✅ | ✅ |
| 🇩🇪 Deutsch | ✅ | ✅ | ✅ | ✅ |
| 🇪🇸 Español | ✅ | ✅ | ✅ | ✅ (snippet) |
| 🇫🇷 Français | ✅ | ✅ | ✅ | ✅ (snippet) |
| 🇯🇵 日本語 | ✅ | ✅ | ✅ | ✅ (snippet) |

Auto-Detect via Navigator-Language, manueller Switch via Dropdown in App
(Profil) und Marketing-Nav (Flag-Chip). Persistiert in `localStorage`.
Hreflang-Tags + canonical für SEO.

### Marketing-Page (swingandsavor.at)
- **5-Sprachen-Dropdown** in Nav mit Flag-Chip-Trigger und ausklappbarem Menü
- **App-Store-Badges**: prominenter PWA-„Play instantly", App Store + Google Play
  mit „Soon"-Tag bis Native live geht
- **Phone-Mockup-Section**: 3 iPhone-Frames (Leaderboard / Match-Detail / Profile)
  mit Tilt-Hover
- **Discord-Community-Section**: eigenes Block mit Logo + Channel-Chips +
  prominenter CTA
- **Sticky-Mobile-CTA-Bar**: slidet bei Scroll auf Mobile rein
- **Live-Counter im Hero**: echte Zahlen aus `public-stats` Edge Function
  (1,745 Courses · 13 Countries · iOS/Android/Web), gecached 5min
- **Newsletter-Capture im Footer**: Email-Input + Subscribe-Button mit
  Bestätigungs-Mail via Resend (DSGVO-Confirm)
- **DealBuddy-Pitch entschlackt**: Insider-Sprech raus, klarer Pitch zu
  „social bets between friends — never gambling"

### Backend (Supabase Edge Functions)

| Function | Auth | Use |
|---|---|---|
| `discord-notify` v3 | shared secret | Auto-Post bei Cup-Create/Finish, bilingual DE/EN |
| `public-cup` | open (verify_jwt=false) | Cup-Daten + Live-Score für `/c/:invite_code` |
| `claim-referral` | JWT (signed-in user) | Nimmt `?ref=XXX` aus Storage, schreibt referrals |
| `public-stats` | open | Aggregierte Counts für Live-Counter |
| `subscribe-newsletter` | open | Newsletter-Anmeldung + Confirm-Mail via Resend |

### Datenbank (Migrations)

- `referral_system`: `profiles.ref_code` + `referrals`-Tabelle (first-touch unique)
- `discord_notify_trigger`: pg_net, trigger function, INSERT+UPDATE-trigger
- `newsletter_subscribers`: email + status + confirm_token, service-role-only

### App (PWA)
- 5-Sprachen-Strings (~200 keys/Sprache) für alle Top-Level-Screens
- Referral-Card im Profil mit eigenem 8-Char-Code + Share-Button
- Sprach-Switcher im Profil (Liste mit 5 Flaggen)
- Quick-Switch-Chip auch im Sign-In-Screen
- Public-Cup-Page `/c/:invite_code` (öffentlich, kein Login)
- ShareSheet überall: Profil (Referral), CupScreen (per Cup), Public-Cup (Header)
- DealBuddy-Push in Public-Cup bei finished + im Discord-Embed

### Discord-Community
- Server live: invite `https://discord.gg/jT2GpZqZVE`
- 5 Kategorien, 18 Text-Channels, 2 Voice-Channels, 10 Rollen
- Welcome-Posts in Regeln/Ankündigungen/Roadmap/FAQ
- 2 Webhooks für Cups + Leaderboards (Auto-Post-fähig)
- Bilinguale Embeds (EN-Titel + DE/EN-Zeile + Public-Cup-Deeplink + DealBuddy-Hook)

---

## 📋 Was als Source-of-Truth für die Native-Launches existiert

- `ASO_LISTINGS.md` — Subtitle/Description/Keywords pro Sprache, ready für
  App Store Connect + Google Play Console (Einspielung via `.apple-bootstrap/`-Scripts)
- `.apple-bootstrap/set-asc-listing.js` — pusht via Apple API
- `.apple-bootstrap/set-age-rating.js` — 4+
- `.apple-bootstrap/set-pricing-free.js` — Free
- `.apple-bootstrap/wait-for-build.js` — Build-Polling

---

## 🌍 Domain / Hosting

| Asset | Host |
|---|---|
| swingandsavor.at | Vercel (`swingandsavor-website` project) — finalized deploy: dpll93j7v |
| app.swingandsavor.at | Vercel (main app repo) — auto-deploy on push |
| Supabase | rcqichlyllhwougopfkg (eu-central) |
| Resend | hi@swingandsavor.at — domain verified |
| Discord | server-id 1505552850078400581 |

---

## 🛣 Was bewusst offen geblieben ist (Roadmap)

Diese Sachen sind nicht Blocker für Viral-Ready-State, sondern Polish-Phasen:

### Phase H — Echte App-Screenshots in Mockups
Aktuell stilisierte SVG-Cards. Echte Screens via Playwright-Screen-Capture aus
Storybook oder direkt aus der App im Mobile-Viewport.

### Phase I — Match-Result-Share als Image (OG-PNG)
Bei jedem Cup-Final automatisch generierte 1200×630 PNG (Edge Function +
Satori/ImageMagick) → Native Image im Web-Share-API, 9:16-Variante für IG-Stories.

### Phase J — Public Player-Profile
`/u/:handle` öffentlich lesbar mit Stats + Badges + OG-Image.

### Phase K — Multi-Format Scoring
Stableford + Stroke Play zusätzlich zu Match Play. Schema-Erweiterung + UI-Toggle.

### Phase L — World Handicap System (WHS)
HCP-Updates nach jedem Cup automatisch via 8-aus-20 differential-Formel.

### Phase M — GPS-Distance pro Loch
Anreichern der 1,745 Courses mit Loch-GPS-Punkten.

### Phase N — TikTok/Reels-Templates
Cup-Recap als 15-Sek-Animation via Remotion-Pipeline. Schon im Roloff-Stack
verfügbar (`project_fal_ugc_pipeline`).

### Phase O — DealBuddy Tiefer-Koppeln
Match-Anmeldung mit prefilled Side-Bet-Form-Deeplink. Cup-Sponsoring via
DealBuddy-Leaderboard.

---

## 📊 Live-Verifikation (curl)

| Endpoint | Erwartung | Live |
|---|---|---|
| https://swingandsavor.at/ | HTTP 200, EN-Default, store-badges, newsletter | ✅ |
| https://swingandsavor.at/?lang=ja | JA-Locale aktiv | ✅ |
| https://app.swingandsavor.at/ | PWA login, lang-chip oben rechts | ✅ |
| `…/functions/v1/public-stats` | `{courses:1745, countries:13, ...}` | ✅ |
| `…/functions/v1/public-cup?invite=X` | 404 für unknown, 200 für valid | ✅ |
| `…/functions/v1/subscribe-newsletter` | 200 + Confirm-Mail | ✅ |
| `…/functions/v1/claim-referral` | 401 ohne JWT, 200 mit | ✅ |
| Discord-Webhook Cup-Create | 200 → Post in `🏆-cups` | ✅ |
| Discord-Webhook Cup-Finish | 200 → Post in `📊-leaderboards` | ✅ |

---

## 🎯 Bottom Line

App, Marketing-Page, Backend, Community sind jetzt international,
mehrsprachig, viral-ready und mit DealBuddy konsistent gekoppelt.

Die nächste Welle ist Native-Launch (Apple/Google) — die Listings dafür
liegen bereit in `ASO_LISTINGS.md`.
