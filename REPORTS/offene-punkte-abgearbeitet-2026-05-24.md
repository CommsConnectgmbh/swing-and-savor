# S&S — Offene-Punkte-Sweep 2026-05-24

Stand 2026-05-24, Commit `b16b95a` auf `main`. Drei code-bare Offenpunkte
aus dem Tournament-Features-Report (2026-05-23) und dem ASC-Submission-Skript
abgearbeitet.

## 1. asc-submission IN_REVIEW-Fix

**Vorher:** `scripts/asc-submission.mjs` versuchte in IN_REVIEW alle drei
"always editable"-Felder zu patchen (`promotionalText`, `supportUrl`,
`marketingUrl`) und lief in HTTP 409 STATE_ERROR, weil Apple `supportUrl`
und `marketingUrl` in IN_REVIEW sperrt.

**Fix:** State in zwei Klassen aufgeteilt:
- `hardLocked` (IN_REVIEW, PROCESSING_FOR_APP_STORE, PENDING_APPLE_RELEASE,
  READY_FOR_DISTRIBUTION) → nur `promotionalText` patchen.
- `softLocked` (WAITING_FOR_REVIEW) → wie vorher promo+support+marketing.
- alles andere → voller Patch inkl. description/keywords/whatsNew.

Smoke gegen Live-ASC: `Version: 1.0 (IN_REVIEW)` → `Localization gepatcht`
ohne 409. Review-Detail + Build-Link wie gehabt.

## 2. PublicCupScreen Render rules/entry/join

**Vorher:** Edge-Function `public-cup` v5 lieferte `rules_md`,
`entry_conditions`, `join_mode`, `max_participants` schon mit, das Frontend
hat sie aber nicht gerendert.

**Fix:** `src/screens/PublicCupScreen.jsx` zwischen Scorecard und Actions:
- Badge-Reihe für `join_mode` (open/request, invite_only bleibt unsichtbar)
  und `max_participants`.
- Card "Teilnahmebedingungen" als 2-Spalten dl mit den belegten Keys aus
  `entry_conditions`: handicap_min/max (Range bevorzugt), age_min, gender,
  dress_code, entry_fee_cents (Currency-Format), payout, equipment.
- Card "Regeln" mit `whitespace-pre-wrap` für `rules_md` (kein Markdown-
  Render, bewusst klein gehalten — keine extra deps).

Komplett konditional: keine Felder belegt → Section bleibt komplett weg.

## 3. i18n für die 4 neuen Sheets

**Vorher:** `BoostSheet`, `JoinTournamentSheet`, `JoinRequestsSheet`,
`ScorecardSheet` waren komplett deutsch hartkodiert.

**Fix:** Alle user-facing Strings auf `t()` umgestellt, Keys unter
`sheets.boost`, `sheets.join`, `sheets.joinRequests`, `sheets.scorecard`
in `src/locales/de.json` und `src/locales/en.json` hinterlegt. `es`, `fr`,
`ja` fallen via `fallbackLng: 'en'` (siehe `src/lib/i18n.js`) automatisch
auf Englisch zurück.

Zusätzlich: `new Date(…).toLocaleDateString('de-DE')` / `.toLocaleString('de-DE')`
durch `i18n.resolvedLanguage` ersetzt, sonst hätten EN-User trotz EN-Strings
DE-Datumsformat gesehen. Currency-Format dito (`Intl.NumberFormat` mit
EUR-Currency, Locale dynamisch).

`Pill`-Component bleibt structural, kriegt die übersetzten Labels per Prop.
`SignRow` und `OcrPreviewPanel` in `ScorecardSheet.jsx` kriegen `t` und
`lang` als Prop (statt Hook in Sub-Component aufzurufen).

`npm run build` ✓ grün, 226 Module.

## Was BEWUSST nicht passiert ist

- **OCR-Feldtest auf gpt-4o:** braucht echte Foto-Karten, kann ich
  ohne Vorlage nicht testen. `scorecard-ocr/index.ts` hat einen
  einzeiligen Model-Switch.
- **Play-Console-App-Record:** Google blockt Create via API,
  `scripts/play-status.mjs` druckt 8-Schritte-Anleitung. Rainer muss
  einmalig in der Play Console klicken, danach übernimmt die CI.

## Was Apple-seitig noch läuft

`asc-submission.mjs` zeigt: Version 1.0 ist seit 2026-05-18 22:52 UTC im
State IN_REVIEW. Heute Tag 6, üblicherweise sollte das durch sein. Falls
nicht morgen approved → in ASC „Contact App Review" anschreiben oder
expedited Review anfragen.

## Deploy

- Push `b16b95a` → `CommsConnectgmbh/swing-and-savor:main`
- Vercel `swingandsavor-app` ist GitHub-connected, Build läuft automatisch
- `app.swingandsavor.at` und `swingandsavor.at` antworten beide HTTP 200
