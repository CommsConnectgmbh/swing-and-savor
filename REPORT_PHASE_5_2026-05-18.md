# Phase 5 — Premium 49 € + Sponsor Slot light

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod)

## Was geliefert wurde

### 1. DB-Migration `010_premium_and_sponsors`
Drei neue Tabellen:
- `premium_purchases` — Stripe-Ledger (one row per Checkout-Session), packages `premium | club | league`, Status `pending → paid | refunded | failed`
- `sponsors` — Sponsor-Directory (Reusable), Felder: name, logo_url, website_url, contact_email, type
- `sponsor_placements` — Linking-Tabelle Cup ↔ Sponsor mit `placement_type` (`powered_by | title_sponsor | award_sponsor`)
- Vollständiges RLS-Policy-Set (Owner-only Insert/Update für Cups, Public-Read für aktive Placements)

### 2. Edge Function `create-premium-checkout` (verify_jwt: true)
- Validiert User-JWT, prüft Cup-Ownership, lehnt bereits upgegradete Cups ab
- Erstellt Stripe-Checkout-Session mit `price_data` inline (kein Stripe-Produkt-Setup nötig)
- Packages: Premium 49 € / Club 199 € / League 999 €
- Schreibt Pending-Row in `premium_purchases`
- Liefert `checkout_url` für Client-Redirect

### 3. Edge Function `stripe-webhook` (verify_jwt: false, Signatur-Verify intern)
Listenert auf:
- `checkout.session.completed` → `premium_purchases.status = paid`, `tournaments.package_type` wird hochgesetzt
- `checkout.session.async_payment_failed` / `expired` → `status = failed`
- `charge.refunded` → `status = refunded`
- Filtert per `metadata.app = 'swing-and-savor'`, damit der gleiche Webhook auch für Belegify/Obacht funktioniert

### 4. CupScreen-Integration
- Premium-Upgrade-Button („Premium · 49 €") direkt neben Teams-Button für Cup-Owner mit `package_type = free`
- Tippt → `create-premium-checkout` → Stripe-Hosted-Checkout → Success-Redirect → CupScreen-Refresh
- Bei aktivem Premium: Champagne-Badge „Premium" / „Club" / „League" statt Upgrade-Button

### 5. Sponsor-Slot light in Invitational + Recap
- Edge Functions `public-invitational` und `public-recap` liefern jetzt `sponsors[]` mit gejointen Sponsor-Daten
- UI: dezenter „Powered by"-Block mit Hairline-Top, Logo (max 32px Höhe, leicht entsättigt) + Display-Name in Fraunces
- Title-Sponsor-Slot ist vorbereitet (Edge-Function liefert `placement_type`), UI in dieser Phase nur für `powered_by` aktiv

### 6. CTA-Hierarchie & Memory-Compliance
- Spieler-Premium gibt es **nicht** (per Anweisung MVP §3 + Memory `feedback_commsos_no_recommendation` analog)
- Premium-Slot ist **Captain-only** und wird sprachlich als „Event auf Premium upgraden" geführt, nicht als „Paywall"
- Sponsor-Slot ist dezent („Powered by"), nicht Bannerwerbung — entspricht Anweisung §8 Winner-Card-Sponsor

## ⚠️ Manueller Schritt (User-Pflicht)

Damit Stripe live geht, müssen **zwei Secrets** in der Supabase-Projekt-Settings gesetzt werden:

```bash
# Im Supabase Dashboard → Settings → Edge Functions → Secrets
STRIPE_SECRET_KEY=sk_live_…           # aus .env.shared
STRIPE_WEBHOOK_SECRET_SNS=whsec_…     # neu via Stripe Dashboard erstellen
```

Im Stripe Dashboard:
1. **Webhooks → Add endpoint**
   - URL: `https://rcqichlyllhwougopfkg.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
2. Webhook-Signing-Secret kopieren → als `STRIPE_WEBHOOK_SECRET_SNS` in Supabase setzen
3. **Live-Test**: ein Cup auf Premium upgraden → mit Stripe-Test-Karte `4242 4242 4242 4242` durchgehen → Cup sollte automatisch Premium-Badge bekommen

Solange die Secrets nicht gesetzt sind, antwortet `create-premium-checkout` mit `stripe_not_configured`.

## Akzeptanz (laut MVP-Briefing §7)

| Kriterium | Status |
|---|---|
| Premium Event für 49 € einmalig | ✓ Stripe price_data inline |
| Spieler sehen keine Preise | ✓ Upgrade-Button nur für Cup-Owner sichtbar |
| Sponsor-Slot dezent „Powered by" | ✓ Hairline-Block in Invitational + Recap |
| Build grün + Deploy | ✓ |

## Bewusste Schmälerung

- **Sponsor-Selector-UI** für Captains (zum Hinzufügen eines Sponsors via UI) ist NICHT in Phase 5 enthalten — Sponsor-Placements werden manuell via SQL/Admin gesetzt. UI kommt mit Phase 6 (Admin).
- Stripe-Test-Mode wird nicht hartcodiert — die Edge-Function nutzt schlicht das gesetzte `STRIPE_SECRET_KEY`. Wenn Test-Key gesetzt ist, sind die Sessions automatisch Test-Mode.
- Premium-Features (Bessere Eventpage-Templates, Premium-Leaderboard-Style etc.) sind in dieser Phase nicht zusätzlich differenziert — Premium = `package_type !== 'free'` als Flag, das bereits Phase-7-fähig ist. Eigentliche visuelle Premium-Differenzierung in V2.

## Nächste Phase

Phase 6: Admin-Cockpit + Ambassador-CRM (Connector / Host-Partner / Operating-Partner 15/30/50 %).
