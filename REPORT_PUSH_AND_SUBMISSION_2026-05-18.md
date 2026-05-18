# Push, ASC-Submission, Play-Status (2026-05-18)

**Trigger:** Rainer: „das kannstdu doch" auf die offenen Manuell-Punkte.

Ehrliche Aufteilung: zwei der drei Sachen autonom durchgezogen, der dritte ist auf Google-Seite per UI gesperrt — klar dokumentiert.

## 1) Push-Pipeline — ✅ live

**Was steht:**
- VAPID-Keypair generiert (Public + Private + Subject `mailto:hi@swingandsavor.at`)
- `VITE_VAPID_PUBLIC_KEY` in Vercel-Project `prj_FSa7oNNFonYoq7b8hFDfyr2oYQ96` (production+preview+development) via Vercel-API
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_INTERNAL_KEY` in Supabase Function-Secrets via Management-API
- `.env.shared` updated (alle Keys mit `_SWINGSAVOR`-Suffix)
- Edge Function `send-push` deployed (Deno + `npm:web-push@3.6.7`), Smoke `HTTP 200`
- Migration 007: `app_config`-Tabelle + `call_send_push(uuid[], jsonb)` RPC + 3 Trigger:
  - `messages_push` → DM-Empfänger
  - `reactions_push` → Tournament-Owner bei Like
  - `comments_push` → Owner + alle Mit-Kommentatoren
- Trigger nutzen `pg_net.http_post` mit `x-internal-key` Header zur Auth
- Vercel-Redeploy gepullt, Bundle `index-CiCOytXF.js` enthält den Public Key in `ProfileScreen-CVI3Qr6s.js` — verifiziert

**Wie testen (User-Side):**
1. App auf `app.swingandsavor.at` → Profil
2. Push-Karte → „Einschalten" → Browser-Permission-Prompt
3. In zweitem Browser ein Like / Kommentar / DM senden → Push-Notification ploppt OS-seitig auf
4. Tap → öffnet Deep-Link in der App

**iOS-PWA-Hinweis:** Web-Push funktioniert auf iOS erst ab 16.4 und nur in einer installierten PWA (Home-Screen-Icon). Im Safari-Tab geht es nicht.

## 2) iOS-Submission via ASC API — ✅ so weit Apple es zulässt

**Erkenntnis aus dem Live-Run:** Version 1.0 ist bereits `WAITING_FOR_REVIEW` — Apple hat sie in der Schlange. Da sind die meisten Felder eingefroren. Was gepatcht wurde:

| Feld | Vorher | Nachher |
|---|---|---|
| Age-Rating | SEVENTEEN_PLUS | FOUR_PLUS |
| Promotional Text (DE) | leer/alt | „Cups mit Freunden, Live-Scoring auf jedem Loch, Flight-Matches mit Faktoren, DMs und globale Rangliste. Schnell, intuitiv, ohne Schnickschnack." |
| Support-URL | – | `https://swingandsavor.at/impressum` |
| Marketing-URL | – | `https://swingandsavor.at` |
| Reviewer Demo-Account | – | `apple-review@swingandsavor.at` / `87654321` |
| Reviewer Notes | – | Bypass-Erklärung mit Edge-Function-Hinweis |
| Reviewer Contact | – | rainer.roloff@comms-connect.de / +498945221556 |

**Was eingefroren bleibt:** `description`, `keywords`, `whatsNew`, Build-Verlinkung — alle wegen `WAITING_FOR_REVIEW`. Sind aber alle schon korrekt gesetzt (Build 1.0/1 ist verlinkt, 6 Screenshots da).

**Scripts liegen im Repo:**
- `scripts/asc-submission.mjs` — state-aware, kann jederzeit neu laufen (`--dry` für Trockenlauf)
- `scripts/asc-age-rating.mjs` — patcht Age-Rating-Declaration aller Attribute auf NONE → FOUR_PLUS

**Status:** Submission läuft. Apple-Review dauert üblicherweise 24–48h. Falls Reject, nochmal `asc-submission.mjs` ausführen mit den geänderten Werten und ggf. `--submit` für eine neue Submission (das Script erkennt eine offene Submission und überspringt dann sauber).

## 3) Play-Console — ⚠ blockiert durch Google

`scripts/play-status.mjs` bestätigt: HTTP 404, kein App-Record für `de.commsconnect.swingandsavor`. Google's Android Publisher API erlaubt explizit **kein** „Create App" — das muss zwingend einmal in der Play Console UI geklickt werden.

**5-Minuten-Manuelles für Rainer:**
1. https://play.google.com/console → „App erstellen"
2. App-Name: `Swing & Savor`
3. Default-Sprache: Deutsch (Deutschland)
4. App oder Spiel: App
5. Kostenlos oder kostenpflichtig: Kostenlos
6. Deklarationen: beide Haken (Inhaltsrichtlinien + US-Exportgesetze)
7. Unter „App-Inhalte" → Datenschutz-URL: `https://swingandsavor.at/datenschutz`
8. Setup → API-Zugriff → `play-publisher@comms-play-store.iam.gserviceaccount.com` einladen mit Berechtigung „Admin"

**Sobald App-Record + SA-Zugriff stehen, übernehme ich autonom:**
- AAB aus dem letzten CI-Build hochladen auf Internal Testing
- Store-Listing füllen (Description, Screenshots, Kategorien, Tags)
- Datensicherheit-Formular (parallel zu iOS-Privacy-Werten)
- Promotion zu Closed / Open / Production Track

## Was Rainer jetzt noch tun muss

1. **iOS:** Nichts — App wartet auf Apple-Review. Bei Reject melde ich mich.
2. **Android:** 5 Klicks in der Play Console wie oben — danach sag bescheid und ich mache den Rest.
3. **Push smoken:** Profil → „Einschalten" auf einem Device, ein Like vom anderen Account → Notification kommt.

— Claude Opus 4.7 (1M)
