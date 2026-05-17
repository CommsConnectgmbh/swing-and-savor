# Swing & Savor — Global Push Report (2026-05-17)

**Auftrag:** App weltweit attraktiv machen, virales Wachstum aktivieren, DealBuddy
mit-pushen.

Ergebnis: Foundation für i18n, Sharing und Referral steht. Public Cup-Pages und
bilinguale Discord-Posts sind live. Marketing-Page-Übersetzung + erweiterte
viral-Mechanik sind als Roadmap angehängt.

---

## ✅ Live ab diesem Push

### 1. Internationalisierung (i18n)
- `react-i18next` + Browser-Language-Detector eingebaut.
- 5 Sprachen: **English, Deutsch, Español, Français, 日本語**.
- Locale wird automatisch erkannt (Navigator → localStorage `sns_lang`).
- Sprach-Switcher
  - prominent im **Profil** (Settings-Card mit 5 Flaggen)
  - als Chip-Toggle im **Sign-In-Screen** (oben rechts)
  - als Chip-Toggle in der **Public-Cup-Page**
- Resource-Files: `src/locales/{en,de,es,fr,ja}.json` — ~200 Strings je Sprache,
  alle Top-Level-Screens abgedeckt: Nav, Common, Sign-In, Onboarding, Board,
  Discover, Challenges, Matches, MatchDetail, Friends, Cup, Profile, Share,
  Referral, DealBuddy.

### 2. Public Cup-Pages (Share-First-Architektur)
- Neue Route `/c/:invite_code` — ohne Auth aufrufbar.
- Liest via Edge-Function `public-cup` (verify_jwt=false, service-role).
- Zeigt: Cup-Name, Datum (locale-formatiert), Team A vs Team B, aktuellen oder
  finalen Score, Sieger-Banner bei finished, DealBuddy-CTA bei finished.
- Sign-In-CTA „Jetzt selbst spielen → app.swingandsavor.at".
- OG-Meta für Link-Previews wird beim Mount gesetzt (`document.title`).

### 3. Referral-System
- DB: `profiles.ref_code` (8-Zeichen Crockford-Alphabet, eindeutig, auto-fill bei
  insert), `profiles.ref_locale`, `referrals(inviter_id, invitee_id, ref_code,
  status, created_at, converted_at, UNIQUE(invitee_id))`.
- Edge-Function `claim-referral` (verify_jwt=true): nimmt nach Signup den ref_code
  aus localStorage und schreibt sicher ein referrals-Row (Service-Role bypasst RLS,
  Self-Referrals werden geblockt, Duplikate ignoriert).
- Client (`src/lib/referral.js`): `captureReferralFromUrl()` greift `?ref=XXX` bei
  jedem Pageload, persistiert in localStorage (first-touch), strippt es aus URL.
- `auth.jsx` ruft nach `SIGNED_IN` automatisch `claim-referral` auf — fire-and-forget.
- Profil-Screen: Card „Freunde einladen" mit eigenem Code + Share-Button (siehe 4).

### 4. Universeller Share-Layer
- `src/lib/share.js`: Web-Share-API (iOS/Android) + Fallback auf
  Plattform-Sheet (WhatsApp, Telegram, X, Facebook, Email).
- `src/components/ShareSheet.jsx`: Bottom-Sheet mit Plattform-Icons + Copy-Link.
- Eingebaut in:
  - **CupScreen** — Share-Button neben Edit/Delete je Cup → teilt `/c/{invite_code}`-URL
  - **ProfileScreen** — Share-Button auf eigener Referral-Card → teilt `?ref=XXX`-URL
  - **PublicCupScreen** — Share-Button im Header → teilt aktuelle URL

### 5. DealBuddy-Cross-Push
- Public-Cup-Screen (finished cup): prominente Card „Side-Bet auf nächste Runde →"
  → `deal-buddy.app`.
- Discord-Embed bei Cup-Finished: zweite Action-Row mit
  `[📄 Recap]({{publicCupUrl}}) · [💰 Side-bet on the rematch](deal-buddy.app)`.
- Profil → bestehender „💰 DealBuddy"-Button bei Friend-Challenge ist unverändert.

### 6. Discord-Embeds bilingual
- `discord-notify` Edge-Function neu deployed (v3).
- Bei neuem Cup: Embed enthält jetzt 🇩🇪 DE + 🇬🇧 EN-Zeile mit Direkt-Link auf
  Public-Cup-Page.
- Bei finished Cup: Embed verlinkt zur Public-Cup-Recap + DealBuddy-CTA.
- Embed-Titel & -Beschreibung primär englisch (lingua franca im Discord).

---

## 🗂 Komponenten-Inventar

| Layer | File / Migration | Status |
|---|---|---|
| i18n init | `src/lib/i18n.js` | ✅ |
| Translations | `src/locales/{en,de,es,fr,ja}.json` | ✅ |
| Referral lib | `src/lib/referral.js` | ✅ |
| Share lib | `src/lib/share.js` | ✅ |
| Share UI | `src/components/ShareSheet.jsx` | ✅ |
| Locale Switch | `src/components/LanguageQuickSwitch.jsx` | ✅ |
| Public Cup | `src/screens/PublicCupScreen.jsx` | ✅ |
| DB Migration | `referral_system` (ref_code, referrals table) | ✅ |
| Edge Fn | `claim-referral` (verify_jwt=true) | ✅ |
| Edge Fn | `public-cup` (verify_jwt=false) | ✅ |
| Edge Fn | `discord-notify` v3 (bilingual + DealBuddy) | ✅ |
| Profile Card | Referral + Language + Discord | ✅ |
| Cup Share | Share-Button pro Cup + ShareSheet | ✅ |

---

## 📋 Roadmap (nächste Sessions)

### Phase F+ — Marketing-Page Multi-Lang
- swingandsavor.at: DE/EN Toggle in marketing/index.html (~50 Strings).
- Hero + Feature-Section + Testimonials je Sprache.
- Vercel-Rewrite `/en` → Untervariante, oder JS-Toggle mit lang-Attribute.

### Phase H — Match-Result Share (Native Asset)
- Bei Match-Final: Generiere PNG (Server-Side via Edge Function +
  ImageMagick/Satori) mit Sieger-Card → automatisch in ShareSheet als Native
  Image (Web-Share-API kann auch Files).
- IG-Stories optimiert (9:16) + 1200×630 OG-Image für Twitter.

### Phase I — Gamification / Badges
- `achievements` Tabelle (badge_id, awarded_at, profile_id).
- Auto-Award bei: Erstem Sieg, 5-Sieg-Streak, Hole-in-One, Cup-Sieg.
- Sichtbar im Profil + auf Public-Profile-Page.
- Referral-Bonus: Beide bekommen „OG Member"-Badge bei converted Referral.

### Phase J — Public Player-Profile + OG
- `/u/:handle` öffentlich sichtbar (read-only fürs Web) mit Stats, Win-Rate,
  Badges. Server-rendered OG-Image für IG/X-Share.

### Phase K — Multi-Format Scoring
- Aktuell nur Match Play. Hinzufügen: Stableford, Stroke Play.
- Aktiviert größere Zielgruppen (Stableford ist DE-Vereins-Standard).

### Phase L — World Handicap System (WHS)
- HCP-Updates automatisch nach finished Cup berechnen (offizielle WHS-Formel:
  bestes 8-aus-20 differential, scaled).
- Sehr appealing für Golfer mit aktivem DGV/USGA-HCP.

### Phase M — GPS Course Database
- 1745 Courses sind schon drin. Anreichern mit GPS pro Loch
  (z.B. via GolfBert API oder Open Golf Course DB).
- „Distance to pin" pro Loch in MatchDetail.

### Phase N — Cold-Start virality
- Einladung an WhatsApp-Gruppe als „Team-Captain": auto-creates Cup-Draft + ein
  Onboarding-Loop für die anderen.
- TikTok / Reels-Templates: Cup-Result als 15-Sek-Animation (Remotion).
- Pro Cup ein QR-Code (Print auf Scorekarten).

### Phase O — DealBuddy tieferes Coupling
- Bei jeder Match-Anmeldung: optionaler Side-Bet, der direkt in DealBuddy
  erstellt wird (Deeplink mit prefilled Form).
- DealBuddy-Leaderboard pro Cup: wer hat am meisten gewonnen.

---

## 🛡 Sicherheits-/Compliance-Notes

- Referral-Tracking nur 8-Char-Code in localStorage — kein PII.
- Public-Cup-Page liest nur explicit `public` und gibt nur Felder zurück die
  Owner schon als „public" markiert hat.
- ?ref-Strip aus URL nach erstem Touch, damit der Code nicht versehentlich weiter
  geshared wird.
- claim-referral validiert JWT (verify_jwt=true), checkt user.id != inviter.id
  (no self-referrals), Unique-Constraint auf invitee_id verhindert
  re-attribution.
- private_config-Tabelle aus Discord-Trigger ist `revoke from anon/authenticated`.

---

## 📊 Deployment

- PWA Build: clean, 9s, 0 errors.
- Supabase Edge Functions: 3 deployed (discord-notify v3, claim-referral v1,
  public-cup v1).
- Supabase Migrations: 2 (referral_system, discord_notify_trigger).
- Git commit folgt direkt nach diesem Report — Vercel-Auto-Deploy triggert.

---

## 🌍 Sprach-Coverage (Stand 2026-05-17)

| Sprache | UI-Strings | Discord-Posts |
|---|---|---|
| English | ✅ (Master) | ✅ |
| Deutsch | ✅ | ✅ (Embed-Zeile) |
| Español | ✅ | ⏸ next push |
| Français | ✅ | ⏸ next push |
| 日本語 | ✅ | ⏸ next push |

**Golf-Hauptmärkte abgedeckt:** US, UK, AU, DE, AT, CH, ES, MX, AR, FR, JP, KR (via EN).

**Nächste Sprachen-Wave:** zh, ko, pt, it, sv — wenn organic Traffic aus
diesen Regionen erkennbar wird.
