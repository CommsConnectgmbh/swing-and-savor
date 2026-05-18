# Swing & Savor — Social v3 + Tour + Stableford + Submission-Doku (2026-05-17)

**Trigger:** Rainer: „ok dann los" auf 5-Punkte-Plan (Social-Interactions → Push → iOS-Submit → Tour-Tab → Turnier-Formate).

Was real autonom durchgezogen wurde: **alle 5 Stücke**, mit Push pragmatisch in „In-App + Web-Push-Setup" gesplittet (Native-Push hängt an Credentials, die ich nicht setzen kann).

## Was jetzt live ist

### 1. Social-Interaktionen (Likes + Comments + Share)

**Schema (Migration 006):**
- `match_reactions` (PK match_id+user_id, default Emoji ❤️, Realtime)
- `match_comments` (mit `hidden` + `report_count`, RLS versteckt hidden außer für Author, RPC `report_comment(uuid)` setzt `hidden=true` ab 3 Reports — Auto-Moderation ohne dass jemand schauen muss)
- View `match_social_counts` für Performance auf Feed-Counts

**UI:**
- `SocialBar` (Like/Comment/Share) auf jeder Feed-Card UND oben im MatchDetail. Optimistisches Like-Update, Realtime-Sync auf den `match_reactions`-Channel
- `CommentsThread` im MatchDetail — Avatare, Profil-Deep-Link, Compose, Delete-Own, Report-Andere. Realtime-INSERT/DELETE-Sub
- **Share-Card-Generator** (`lib/shareCard.js`): rendert eine 1080×1080 PNG-Recap-Card komplett auf Canvas (kein npm-Package, kein Bundle-Overhead). Brand-Layout mit Team A/B Namen, Score-Box, Course, Cup, swingandsavor.at-Footer. Nutzt `navigator.canShare({files})` für native Share-Sheet (iOS/Android Browser), fallback auf PNG-Download.

### 2. In-App-Notifications + Web-Push-Setup

**In-App Toasts (immer aktiv wenn App offen):**
- `Toaster.jsx` als Portal am App-Root, `toast.js`-Bus für `pushToast({title, body, action, icon})`
- `liveEvents.js`: globale Realtime-Subscription startet beim Login. Triggert Toasts für:
  - **DM** in einer meiner Konversationen → `💬 Hans` + Body, Tap → `/messages/:id`
  - **Like** auf einem meiner Matches → `❤️ Hans hat geliked`, Tap → `/matches/:id`
  - **Kommentar** auf einem meiner Matches → `💬 Hans kommentiert` + Body
  - **Match-Status** wechselt auf `active` oder `finished` in einem meiner Cups

**Web Push (Browser/PWA):**
- Service Worker `public/sw-push.js` mit `push` + `notificationclick` Handlers, navigiert zur Deep-Link-URL
- `webPush.js`-Helper: Permission, PushManager-Subscribe, Speichern der `endpoint + keys` in `push_subscriptions`
- ProfileScreen: Push-Karte mit Ein/Aus-Button, zeigt Browser-Status (default/granted/denied)
- VAPID-Key wird aus `VITE_VAPID_PUBLIC_KEY` gelesen — solange leer, bleibt Web-Push inaktiv (kein Crash, Card zeigt `unavailable`)

**Was zur Push-Vollständigkeit fehlt** (manuell):
1. VAPID-Keys generieren: `npx web-push generate-vapid-keys`
2. Public-Key in Vercel-Env als `VITE_VAPID_PUBLIC_KEY` setzen
3. Private-Key in Supabase-Secrets als `VAPID_PRIVATE_KEY` setzen
4. Edge Function `send-push` deployen: liest aus `push_subscriptions`, sendet JSON-Payload via Web-Push-Protokoll, getriggert von DB-Triggern auf `messages`/`match_reactions`/`match_comments`

Sag bescheid, dann baue ich die Edge Function — braucht aber den manuell-generierten VAPID-Key.

### 3. Tour-Tab Light

`/tour` neue Route, Pille rechts in der HomeScreen-Filter-Row als Einstieg, auch im Profile-QuickLink.

- **Videos**: Channel-Picker (PGA Tour, DP World, LPGA, Masters), YouTube-Embed der „Uploads"-Playlist → live abgerufen, kein Backend nötig
- **Live Scores**: 6 kuratierte Outbound-Links (pgatour.com, europeantour.com, lpga.com, masters.com, usopen.com, theopen.com) in einer ordentlichen Karten-Liste

Ehrlich im Footer dass eigene Live-Daten Datenlizenz brauchen — Tour bleibt eine Bridge, nicht der Hauptzweck.

### 4. Stableford als zweites Spielformat

**Schema:** `matches.format text` default `'match_play'`, check (`'match_play' | 'stableford'`).

**Scoring (`lib/scoring.js`):**
- `stablefordPoints(strokes, par)` → 4 Eagle / 3 Birdie / 2 Par / 1 Bogey / 0 schlechter (brutto, kein Course-HC-Distribution — bewusst v1)
- `calcStablefordTotals(holes)` → `{a, b}` mit Summen

**UI:**
- **MatchesScreen** Create-Form: Format-Toggle zwischen Match Play + Stableford direkt unter dem Type-Selector
- **MatchDetailScreen**: bei `format='stableford'` werden `ptsA/ptsB` aus Stableford-Summen statt Holes-Won berechnet; per-Loch-Result-Spalte zeigt Stableford-Punkte (A oben / B unten) statt Winner-Dot; Title-Label „Singles · Stableford"; `handleFinish` wählt Winner über höhere Stableford-Summe
- **HomeScreen-Card**: Live-Score-Box zeigt `12:9` mit Leader-Färbung statt `3 UP`

**Bewusst nicht in v1**: Echte Handicap-Verteilung (Course-HC × Slope, Stroke-Index-basierte Vorgabe-Schläge). Brutto-Stableford ist für Buddies-Cups ein vollwertiges Format; Netto-Stableford wäre eine weitere Iteration mit `course_handicap` pro Spieler + Stroke-Index aus `hole_handicaps`.

### 5. iOS-Submission-Doku

`docs/iOS_SUBMISSION_CHECKLIST.md` — konkrete Click-Through-Schritte was Rainer in ASC manuell tun muss:

1. App Privacy ausfüllen + **„Veröffentlichen"** klicken (oben rechts, sonst APP_DATA_USAGES_REQUIRED)
2. Reviewer-Credentials hinterlegen (`apple-review@swingandsavor.at` + Code `87654321`, Bypass-Function deployed)
3. Promotional Text + Description + Keywords (alles DE-Copy fertig formuliert)
4. Screenshots (Liste der 6 Screens, iPhone 6.7" 1290×2796)
5. Build 1.0/1 aus TestFlight wählen
6. Age Rating 4+ (Tour-Tab kuratiert, nicht offener Browser)
7. Submit for Review

Plus Android-Play-Track Doku (Tester-Liste, AAB-First-Upload, danach CI-Auto-Deploy).

## Verifikation

- `npm test -- --run` → 14/14 grün
- `npm run build` → 10 s sauber, neue Chunks Tour 4 kB / Toaster + neue Lib-Files small
- Migration 006 applied (success)
- Commits: `b02c59d` (Social v2) → `ac472f9` (Social v3 + Tour + Stableford) auf `main`, gepusht
- Vercel-Deploy läuft, Bundle-Check im Hintergrund

## Smoke-Test

1. Open `/home` → ❤ + 💬 + Teilen-Button unter jeder Card. Like ist instant (optimistisch).
2. „Teilen" → Bild-Recap als 1080×1080 PNG, native Share-Sheet auf Mobile.
3. „💬" → springt im MatchDetail zum Comments-Block. Kommentieren → erscheint instant + in 2. Tab eines Freundes via Realtime.
4. Header-Icon-Spotting: Pokal (Rangliste) + Sprechblase (Nachrichten mit Unread-Badge).
5. `/profile` → Push-Card → „Einschalten" (zeigt Permission-Prompt). Solange `VITE_VAPID_PUBLIC_KEY` nicht gesetzt ist, bleibt Push-Card auf „unavailable" und wird nicht angezeigt.
6. `/tour` → Channel wechseln → YouTube-Playlist tauscht sich.
7. `+ Match` → Format-Toggle „Stableford" → Match anlegen → MatchDetail zeigt Stableford-Punkte pro Loch und gewinnt auf höchster Summe.
8. App im 2. Browser-Tab offen → Freund kommentiert dein Match → Toast pop-up oben mit Tap-to-Open.

## Roadmap-Status

| # | Block | Status |
|---|---|---|
| 1 | Social-Interactions (Likes/Comments/Share) | ✅ live |
| 2a | In-App-Notifications | ✅ live |
| 2b | Web-Push Setup | ✅ scaffolded, wartet auf VAPID-Key |
| 2c | Native Push (APNs/FCM) | Capacitor-Plugin offen, braucht Apple Push Key + Firebase Setup |
| 3 | iOS-Submission | ✅ Doku, manueller Submit folgt |
| 4 | Tour-Tab Light | ✅ live (YouTube + Outbound) |
| 5 | Turnier-Formate | ✅ Stableford live, KO-Bracket + Ryder-Cup-Multi-Round offen |

Sag „mach KO-Bracket" oder „mach VAPID + Edge Function" und ich nehme das nächste.

— Claude Opus 4.7 (1M)
