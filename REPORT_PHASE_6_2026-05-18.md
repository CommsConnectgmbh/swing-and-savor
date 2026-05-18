# Phase 6 — Admin-Cockpit + Ambassador-CRM

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod), Route `/admin`

## Strategischer Kontext

Per Ambassador-Briefing §8–§14: kein automatisches Affiliate-System, sondern ein manuelles, eventbezogenes CRM-Modul mit klaren Schutzregeln (pro Event, Deckungsbeitrag statt Umsatz, 12-Monats-Verfall, manuelle Freigabe).

## Was geliefert wurde

### 1. DB-Migration `011_ambassador_crm`

**`ambassadors`** — Partner-Directory:
- `name`, `email`, `phone`, `community_region`, `notes`, `status` (`active | inactive | blocked`)
- Vollständige RLS-Sperre via `auth.jwt() ->> 'email' = 'rainer.roloff@comms-connect.de'` (Memory-Regel `feedback_commsos_rainer_only_crm`)

**`event_ambassadors`** — Per-Event Commission-Ledger:
- `partner_role` (5 Rollen: `connector` 15 % / `host_partner` 30 % / `operating_partner` 50 % / `renewal_passive` 15 % / `renewal_active` 30 %)
- `commission_rate` (numeric)
- `revenue_gross`, `direct_event_costs`
- `operating_contribution` (Postgres `generated always as` → `revenue_gross - direct_event_costs`)
- `commission_amount` (via Trigger berechnet)
- `claim_valid_until` (Default = `current_date + 12 months`)
- `approval_status` (`draft → pending_review → approved | rejected → paid`)
- `contribution_description` (Free-Text, „Partner-Leistung")

**`calc_commission_fields()` Trigger** — implementiert §9 Berechnungslogik exakt:
```text
contribution = revenue_gross - direct_event_costs
if contribution <= 0 then commission = 0
else commission = round(contribution * (rate / 100), 2)
```

### 2. AdminScreen `/admin` (Rainer-only Email-Gate)

- 4 Editorial Tabs: **Overview · Ambassadors · Ledger · Cups**
- Email-Check Client-Side + RLS Server-Side (Belt and Suspenders)
- Nicht-Admins sehen Editorial „Admin only · Diese Sicht ist Rainer vorbehalten" mit Link zum Clubhouse

**Overview-Tab — Founder Stats:**
- Cups Total / Active / Premium
- Ambassadors / Active Partners
- Total Revenue / Deckungsbeitrag / Commission Open / Commission Paid

**Ambassadors-Tab:**
- Inline-Form: Name / Email / Phone / Region / Notes
- Liste mit Inline-Status-Selector (active / inactive / blocked)

**Ledger-Tab:**
- Inline-Form: Cup-Selector + Ambassador-Selector + Rolle (5 Optionen mit % im Label) + Revenue + Costs + Description
- Auto-Berechnung von Contribution + Commission via Trigger
- Liste pro Eintrag mit 4-Spalten-Stats-Row (Revenue / Costs / Contrib. / Commission)
- Inline-Status-Selector mit Auto-Timestamp (`approved_at` / `paid_at`)
- **CSV-Export-Button** „⇣ Export CSV" liefert Excel-fertige Tabelle

**Cups-Tab:**
- Letzte 50 Cups mit Package-Type-Badge

### 3. Routing
- `/admin` registriert in `App.jsx` als geschützte In-App-Route
- Nicht via Bottom-Nav exponiert (Memory-Regel `feedback_commsos_no_recommendation` analog: kein Verkauf-/Marketing-Surface)

## Implementierte Schutzregeln (Ambassador-Briefing §12)

| Regel | Umsetzung |
|---|---|
| Pro Event, nicht pro Kunde | ✓ `event_ambassadors` ist always `tournament_id`-bound |
| Keine Lifetime Revenue Shares | ✓ Kein Cron-Job, keine Auto-Renewal-Logik |
| 12-Monats-Regel | ✓ `claim_valid_until` Default via Trigger |
| Keine automatische Exklusivität | ✓ Keine Region-Locks in Schema |
| Daten gehören Swing & Savor | ✓ RLS Admin-only auf beiden Tabellen |
| Manuelle Freigabe | ✓ `approval_status` workflow `draft → pending_review → approved → paid` |
| Deckungsbeitrag statt Umsatz | ✓ Postgres Generated Column |

## Akzeptanz (Ambassador-Briefing §13)

| Kriterium | Status |
|---|---|
| Ambassador anlegen | ✓ |
| Event verknüpfen | ✓ via Ledger-Form |
| Rolle auswählen (5 Optionen) | ✓ |
| Satz automatisch setzen | ✓ Client-Side Map + Trigger sync |
| Deckungsbeitrag berechnen | ✓ Postgres Generated Column |
| Provision berechnen | ✓ Trigger |
| Leistung dokumentieren | ✓ `contribution_description` |
| Freigabe steuern | ✓ 5-Status-Workflow |
| CSV-Export | ✓ Browser-Download |

## Bewusste Vereinfachungen

- Keine automatische Auszahlung (Stripe Connect Payout) — laut Briefing §14 ausdrücklich nicht gefordert
- Keine öffentliche Partner-Sicht / kein Partner-Dashboard für Ambassadors selbst (sie sehen ihre Commissions nur via PDF/CSV, das Rainer manuell teilt)
- Kein Multi-Admin — der Email-Check ist hartkodiert auf `rainer.roloff@comms-connect.de`. Falls später erweitert: in eine `admin_emails`-Tabelle migrieren.

## Gesamtstatus

Alle 7 Phasen aus dem Umsetzungsplan vom 2026-05-18 sind ausgeliefert und deployed.

| Phase | Status |
|---|---|
| 0 — Brand & Language Reset | ✓ |
| 1 — Invitational Hero | ✓ |
| 2 — Winner Cards + Strava Story Overlay | ✓ |
| 3 — Recap Magazin | ✓ |
| 4 — Hall of Fame light | ✓ |
| 5 — Premium 49 € + Sponsor Slot | ✓ (Stripe-Secrets-Setup steht aus) |
| 6 — Admin + Ambassador CRM | ✓ |

## Nächste Schritte (außerhalb des Plans)

1. **Stripe Secrets setzen** (siehe REPORT_PHASE_5)
2. **Foundation Founder Invitational** als Live-Event durchführen, alle Artefakte (Hero, Story Overlay, Recap, Hall of Fame) im Echtbetrieb beweisen
3. **OG-Meta Server-Side Rendering** (Edge-Middleware für Crawler-User-Agents) — verbessert die WhatsApp/Twitter-Link-Previews drastisch
4. **Cover-Upload-UI im CupScreen** (Captain kann Hero-Bild ändern, statt nur via Admin)
5. **Format-/Location-Felder im Cup-Creator-Formular** (V2 §13)
