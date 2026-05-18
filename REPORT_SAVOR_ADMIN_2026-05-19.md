# Savor — Admin-Cockpit + Schema-Drift-Fix

Datum: 2026-05-19
Deploy: https://app.swingandsavor.at (prod, via Vercel auf main)

## Auslöser

REPORT_SAVOR_2026-05-19 listete als ersten Folgeschritt einen **Savor-Tab im Admin-Cockpit**, damit Founding-Partner und Offers ohne SQL gepflegt werden können. Beim Status-Check fielen drei Drift-Punkte auf:

1. `017_savor_marketplace.sql` war in `REPORT_SAVOR` referenziert, aber nie ins Git committed — Schema lebte nur auf Remote (Drift).
2. Supabase-Advisor meldete `private_config` mit deaktivierter RLS → anon-Key konnte lesen/schreiben.
3. `AdminScreen.jsx` hatte 4 Tabs (overview/ambassadors/ledger/cups) und keine Savor-Sektion.

Alle drei sind in dieser Welle geschlossen.

## Migrationen

### `supabase/migrations/017_savor_marketplace.sql` (Drift-Sync)

Idempotenter Snapshot des Remote-Stands:
- `savor_partners` (id, name, slug, type, logo_url, website_url, city, country_code, description, contact_email, status)
- `savor_offers` (Hauptkatalog, 6 Kategorien, Editorial-Felder, Pricing, Booking, Lifecycle)
- `savor_wishlist` (User favorisiert Offers, unique pro user+offer)
- Slug-Funktionen `gen_partner_slug()` (8 Zeichen) + `gen_offer_slug()` (10 Zeichen)
- Trigger `savor_partners_slug` (INSERT) + `savor_offers_slug` (INSERT/UPDATE)
- RLS: public-read aktive Offers/Partners, Admin-only Write (Rainer-Mail-Gate), Wishlist self-only
- Storage-Bucket `savor-images` (public-read, Admin-write)
- 4 Indexe auf `savor_offers` (Kategorie+Status+Sort, Highlight-partial, City, Tee-Time-partial)

Alle DDLs als `create … if not exists` + `drop policy if exists` davor → re-runnable.

### `supabase/migrations/018_private_config_rls.sql` (Security-Fix)

Aktiviert RLS auf `public.private_config`. Tabelle ist server-only (Service-Role / Edge Functions umgehen RLS), Clients verlieren jeden Zugriff. Auf Remote bereits angewandt via Management-API.

## Admin-Cockpit-Erweiterung

### `src/screens/AdminScreen.jsx`

Tabs erweitert von 4 → 6 (Overview, Ambassadors, Ledger, Cups, **Savor · Partners**, **Savor · Offers**). Tab-Strip ist jetzt horizontal scrollbar auf schmalen Devices.

**Overview** zeigt zusätzlich einen „Savor Lifestyle"-Block mit:
- Partners (gesamt + aktiv)
- Offers (gesamt + live)
- Highlighted-Count

**Savor · Partners**
- Create/Edit-Form: Name, Type (6er-Enum), City, Country-Code, Website, Contact-Email, Description, Logo-Upload
- Logo-Upload geht in `savor-images/partners/{timestamp}-{rand}.{ext}` über `supabase.storage`
- Directory-Liste mit Logo-Thumb, Type-Label, Location, inline Status-Dropdown (active/paused/blocked), Slug-Anzeige, Edit-Button springt zurück in die Form

**Savor · Offers**
- Create/Edit-Form: Category (6er-Enum), Partner-Select (filtert auf active), Title, Subtitle, Description, Cover-Upload (4:5-Vorschau), City+Country, Preis-Cents + Label-Override, Booking-URL, Available-from/until, Tee-Time (nur sichtbar wenn Kategorie `tee_times`), Badge, Sort-Order, Highlight-Toggle
- Cover-Upload geht in `savor-images/offers/{timestamp}-{rand}.{ext}`
- Catalog-Liste mit Kategorie-Filter (All + 6 Kategorien), Cover-Thumb, Featured-Marker, Partner+City+Preis+Slug-Zeile, inline Status-Dropdown (active/sold_out/draft/archived), Edit-Button

Beide Tabs nutzen den bestehenden `load()`-Flow — keine zusätzlichen Loader, keine Datenduplizierung.

## Was bewusst nicht gemacht wurde

- **Keine Demo-Seeds**: per Memory-Regel `feedback_no_demo_fallback` keine Demo-Daten in Production. Savor-Mode zeigt weiterhin den editorialen Empty-State, bis du die ersten echten Partner pflegst.
- **Kein Partner-Delete**: nur Status auf `blocked` setzen (verhindert FK-Kollision mit historischen Offers).
- **Kein Offer-Delete**: Status `archived` reicht (taucht nicht mehr im Public-RLS-Filter auf).
- **Kein Stripe-Checkout-Hook**: bleibt Phase 2, blockiert auf erstem echten Partner-Live-Test.

## Was als nächstes Sinn macht

Nachdem das Admin-UI steht, schrumpft die Roadmap auf:

1. **5–10 Founding-Partner kuratieren und über das neue Cockpit anlegen** — diese Welle hat dafür den Werkzeugkasten geliefert
2. **Stripe-Checkout für Tee-Times** sobald 1. Partner live ist (Provision-Split via Stripe Connect oder manuelle Abrechnung)
3. **Push „Neue Tee Times in [deine Stadt]"** sobald Offers in der DB sind — `push_subscriptions` + `send-push`-Function existieren bereits

## Files

**Neu**:
- `supabase/migrations/017_savor_marketplace.sql` (Drift-Sync)
- `supabase/migrations/018_private_config_rls.sql` (RLS-Fix)
- `REPORT_SAVOR_ADMIN_2026-05-19.md`

**Verändert**:
- `src/screens/AdminScreen.jsx` (+2 Tabs, +2 Tab-Komponenten, +Savor-Stats im Overview, +Storage-Upload-Helper)

## Verifikation

- `npm run build` grün, AdminScreen-Chunk 32 kB / 7,25 kB gzip
- Migration 018 erfolgreich auf Remote `rcqichlyllhwougopfkg` angewandt
- Tabellen savor_partners/savor_offers/savor_wishlist + Bucket savor-images bestätigt vorhanden, RLS aktiv, Admin-Mail-Gate greift
