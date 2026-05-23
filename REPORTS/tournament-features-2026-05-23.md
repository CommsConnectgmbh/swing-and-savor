# Swing & Savor — Tournament-Features 2026-05-23

**Commit:** `62ebea3` auf `main` · gepusht · Vercel-Auto-Deploy läuft auf `swingandsavor-app`
**Supabase-Project:** `rcqichlyllhwougopfkg`
**4 Migrations + 4 Edge-Function-Deploys + 4 neue React-Komponenten**

---

## A · Boost / Highlight (eBay-Kleinanzeigen-Style)

### Schema
- `tournaments.promoted_until timestamptz` — aktiv solange `> now()`
- `tournaments.promo_tier text` — `top | highlight | both`
- `tournament_promotions` — Stripe-Ledger pro Boost-Kauf (tier, duration, amount, session, status, starts_at, expires_at)

### Pricing-Matrix (live)
| Variante | 3 Tage | 7 Tage | 14 Tage |
|---|---|---|---|
| Top | 4,99 € | 9,99 € | 14,99 € |
| Highlight | 2,99 € | 4,99 € | 7,99 € |
| Top + Highlight | 6,99 € | 12,99 € | 19,99 € |

### Stack
- Edge Function `create-boost-checkout` (verify_jwt:true) — Stripe-Checkout-Session, schreibt pending-Row
- Edge Function `stripe-webhook` v2 — switch auf `metadata.purpose='boost'` → setzt `promoted_until` mit Stack-Logik (höherer Tier gewinnt, längerer Zeitraum wird übernommen)
- `BoostSheet.jsx` (Komponente) — 3 Tier-Cards + 3 Dauern, Stripe-Checkout-Redirect
- `CupScreen.jsx` — neuer "Boost"-Button pro eigenem Cup, aktiv-Status grün
- `DiscoverScreen.jsx` — Sortierung: promoted (top|both) zuerst → active → date. Top-Pin + Highlight-Rahmen (`inset 3px 0 0 accent`) + Badges

### UX
- Owner klickt "Boost" → BoostSheet öffnet → Stripe → Success-Redirect zu `/cup?boost=success&cup={invite_code}`
- Sortierung greift sofort beim nächsten Discover-Load
- Stack-Logik: erneuter Kauf verlängert ODER upgradet

---

## B · Turnier-Regeln & Beitritts-Flow

### Schema
- `tournaments.rules_md text` — freier Markdown/Text
- `tournaments.entry_conditions jsonb` — `{handicap_max, handicap_min, age_min, dress_code, entry_fee_cents, payout}`
- `tournaments.max_participants int`
- `tournaments.join_mode text` — `invite_only | open | request`
- `tournament_join_requests` — Audit + Consent (status, rules_accepted_at, display_name, handicap, message)

### RPCs
- `approve_join_request(req_id, team_letter)` — Owner-only, legt `players`-Row an + setzt status='approved'
- `join_open_tournament(t_id, accepted)` — Self-Join im `open` Modus, idempotent

### UI
- `CupScreen.jsx` Form: 5 neue Bedingungs-Felder (HC max/min, Alter, Dresscode, Startgeld, Payout), Regeln-Textarea, 3-Knöpfe Join-Modus, Max-Teilnehmer
- `JoinTournamentSheet.jsx` — zeigt Bedingungs-Pillen + Regeln + Consent-Checkbox + Bedingungs-Check (HC innerhalb min/max?)
- `JoinRequestsSheet.jsx` — Owner-Cockpit, Approve +Team A / +Team B + Reject, pending-Counter
- `DiscoverScreen.jsx` — "Mitspielen" (open) / "Beitritt anfragen" (request) Button pro Tile
- `CupScreen.jsx` Listing: pending-Badge mit Anzahl

### Edge Function
- `public-cup` v5 returnt jetzt auch `rules_md`, `entry_conditions`, `max_participants`, `join_mode`, `promoted_until`, `promo_tier`, `cover_url`, `location_name`, `format`

---

## C · Zähler (Marker), Shuffle, Digital-Unterschrift, Per-Player-Scoring

### Schema
- `match_markers (match_id, player_id, marker_player_id)` PK(match, player) — wer zählt für wen
- `match_signatures (match_id, player_id, role, signer_user_id, signed_at)` — `role in ('player','marker')`
- `player_hole_scores (match_id, player_id, hole_number, strokes, putts, entered_by, source)` — Per-Player Stroke-Play
- `match_player_locked` View — Karte locked wenn beide Signaturen vorliegen

### RPC
- `shuffle_match_markers(m_id)` — sammelt alle `team_a_player_ids ++ team_b_player_ids` (Fallback Legacy-Spalten), rotiert zyklisch (`i % n + 1`), schreibt `match_markers` neu

### RLS-Modell
- Read: jeder der `can_view_match()` darf
- Markers: nur Tournament-Owner
- Scores: Owner ODER zugewiesener Marker (per `players.profile_id = auth.uid()`)
- Signatures: nur eigene (signer_user_id = auth.uid) + Player-Slot oder Marker-Slot oder Owner-Override

### UI
- `MatchDetailScreen.jsx` — neuer "Karten"-Button (accent-grün) im Course-Banner, lädt `flightPlayers` mit profile_id
- `ScorecardSheet.jsx` — Komponente mit:
  - Player-Tabs (✓ wenn locked)
  - Zähler-Zuweisung pro Tab (Select für Owner, read-only sonst)
  - "↻ Zähler shuffeln"-Button (nur Owner)
  - 18-Loch-Grid pro Spieler mit Par-Coloring (Eagle/Birdie/Bogey/Double)
  - Total/Gespielt/Schnitt
  - 2 Unterschriften-Karten (Spieler + Zähler) mit Status + Klick-Sign + Zurück

### UX-Flow
1. Owner legt Match an (flight mit z.B. 4 Spielern)
2. Owner klickt "↻ Zähler shuffeln" → A→B, B→C, C→D, D→A
3. Marker öffnet ScorecardSheet, sieht "Du zählst für X" (Player-Tab des Markierten), trägt Strokes ein
4. Spieler unterschreibt + Zähler unterschreibt → Karte locked, Edits gehen nicht mehr

---

## D · Analoge Scorekarte via Foto-OCR

### Schema
- `scorecard_uploads (match_id, uploaded_by, storage_path, ocr_status, ocr_provider, ocr_result jsonb, applied_at)`
- Storage Bucket `scorecard-photos` (private) + RLS-Policies

### Edge Function
- `scorecard-ocr` (verify_jwt:true) — Signed URL → OpenAI Chat-Completion `gpt-4o-mini` mit `response_format=json_object`, temperature=0, max_tokens=2000
- JSON-Schema: `{ course_name, date, players: [{ name, handicap, holes: [{hole, strokes}], total }], confidence, notes }`
- Schreibt Status + Result zurück in `scorecard_uploads`

### UI (im ScorecardSheet integriert)
- "📷 Foto scannen"-Button → Datei-Picker mit `capture=environment` (Kamera)
- Upload nach `scorecard-photos/{match_id}/{ts}.jpg`
- OCR-Preview-Panel zeigt: Confidence %, Notes, pro erkanntem Spieler `name/HC/erkannte Löcher/Total` + Dropdown "Übernehmen für …" → mapped auf einen `players[]`-Eintrag
- Beim Übernehmen: `player_hole_scores` upsert mit `source='ocr'` + `applied_at` setzen

### Setup
- **OPENAI_API_KEY in Supabase-Secrets gesetzt** ✓ (via Management API)
- gpt-4o-mini Vision: ~0,15 ct pro Karte bei `detail:'high'`

---

## Stripe-Setup

### Was läuft
- `STRIPE_SECRET_KEY` (sk_live) in Supabase-Secrets gesetzt ✓
- `create-boost-checkout` deployed ✓
- `stripe-webhook` v2 deployed (handhabt boost + premium) ✓

### Was zusätzlich erledigt
- **Stripe-LIVE-Webhook-Endpoint angelegt** via Stripe-API: `we_1TaKEmBsPi2wDzPVJbXQMYtR`
  - URL: `https://rcqichlyllhwougopfkg.supabase.co/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed/.async_payment_failed/.expired`, `charge.refunded`
- **Signing-Secret als `STRIPE_WEBHOOK_SECRET_SNS` in Supabase-Secrets** gesetzt ✓
- Smoke-Tests: Webhook 400 (bad-sig wie erwartet), Boost-Checkout 401 (no-JWT wie erwartet), OCR 401 (no-JWT wie erwartet) — Stack vollständig verdrahtet.

---

## Migrations applied (chronologisch)

| # | Datei | Tabellen/Funktionen |
|---|---|---|
| 019 | `019_tournament_promotions.sql` | tournaments.+promoted_until/+promo_tier, tournament_promotions |
| 020 | `020_tournament_rules_join.sql` | tournaments.+rules_md/+entry_conditions/+join_mode/+max_participants, tournament_join_requests, approve_join_request(), join_open_tournament() |
| 021 | `021_markers_signatures_scorecards.sql` | match_markers, match_signatures, player_hole_scores, match_player_locked view, shuffle_match_markers() |
| 022 | `022_scorecard_ocr.sql` | scorecard_uploads, scorecard-photos Storage-Bucket + RLS |

## Edge Functions

| Function | Version | verify_jwt | Zweck |
|---|---|---|---|
| `create-boost-checkout` | 1 | ✓ | Stripe-Checkout für Boost-Kauf |
| `stripe-webhook` | 2 | ✗ | Premium + Boost Webhook-Routing |
| `scorecard-ocr` | 1 | ✓ | OpenAI Vision → strukturierte Hole-Scores |
| `public-cup` | 5 | ✗ | + rules_md/entry_conditions/join_mode etc. |

## Neue Komponenten

- `BoostSheet.jsx` — 3 Tiers × 3 Dauern Checkout-Sheet
- `JoinTournamentSheet.jsx` — Beitritts-Modal mit Consent
- `JoinRequestsSheet.jsx` — Owner-Cockpit für pending Anfragen
- `ScorecardSheet.jsx` — Marker + Shuffle + Sign + OCR (das große Sheet)

## Modifizierte Screens

- `CupScreen.jsx` — Form-Felder Regeln/Bedingungen/Join-Mode + Boost-Button + Pending-Badge + 2 neue Sheets eingebunden
- `DiscoverScreen.jsx` — Sortierung + Badges + Mitspielen-Button
- `MatchDetailScreen.jsx` — "Karten"-Button + ScorecardSheet eingebunden, lädt jetzt `flightPlayers` mit profile_id

## Build

- `npm run build` ✓ — 226 modules, 12s, `MatchDetailScreen` 42 kB / `CupScreen` 49 kB / gzipped jeweils ~12 kB

## Offene Punkte (manuell)

1. **OCR-Feldtest** — Vision-Quality variiert nach Foto-Qualität (Beleuchtung, Schrift). gpt-4o-mini liefert solide JSON, aber bei sehr schlechten Karten lieber gpt-4o nehmen (model-Switch in `scorecard-ocr/index.ts`)
3. **i18n** — die neuen Sheets sind deutsch hartkodiert (nicht via `t()`). Falls EN gebraucht, in `i18n/de.json` + `en.json` keys nachziehen
4. **PublicCupScreen UI** — der Edge-Function-Output enthält jetzt `rules_md` etc., der Frontend-Render der Public-Page wurde noch nicht erweitert (zeigt diese Felder noch nicht an). Beitritts-Button von außen funktioniert über Discover-Feed in der App
