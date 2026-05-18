# Savor — The Lifestyle Layer

Datum: 2026-05-19
Deploy: https://app.swingandsavor.at (prod)

User-Idee: einen **Mode-Switcher** oben in der Header-Bar haben — **Swing** = die Golf-App
(Cups, Invitationals, Match Play, Hall of Fame), **Savor** = Premium-Lifestyle-Layer (Tee Times,
Erlebnisse, Dining, Apparel, Travel, Equipment).

Strategisch beantwortet das den V2-§4-Ausschluss „voller Marketplace im MVP" elegant:
der Marketplace lebt nicht *in* der Golf-App, sondern ist ein **paralleler Modus** mit eigener
Navigation. So bleibt der MVP-Kern fokussiert und die Plattform wächst trotzdem in den
Lifestyle-Status-Markt rein (V2 §7, Roadmap-Addendum Monat 12).

## F12 — Swing | Savor Mode Switch

### `src/components/ModeSwitch.jsx`
- Pill-Toggle direkt im `BrandHeader` (oben rechts neben den Notification-Icons)
- Aktive Hälfte in Champagne mit Brand-Dark-Text
- Inaktive Hälfte Hairline-Bone
- Routing-aware: erkennt `/savor*` und färbt automatisch

### `BrandHeader.jsx` Update
- Title-Prop entfernt (war Route-Label, jetzt überflüssig)
- Logo + Wordmark links, ModeSwitch + Leaderboard-/Messages-Icons rechts

### `BottomNav.jsx` Update
- **Mode-aware Tab-Set**:
  - Swing-Mode: Home / Duelle / `+`-FAB / Matches / Profil
  - Savor-Mode: Discover / Tee Times / Erlebnisse / Shop / Profil
- Wenn der User auf `/savor*` ist, switcht die BottomNav komplett — kein FAB,
  stattdessen ein 5er Editorial-Tab-Set mit Compass/Flag/Sparkle/Bag/User-Icons

## F13 — Savor-Datenmodell (DB-Migration 017)

### Drei neue Tabellen + 1 Bucket
- `savor_partners` (id, name, slug, type [`partner | club | restaurant | travel_op | brand | pro_shop`],
  logo, website, city, country_code, contact_email, status)
- `savor_offers` mit 6 Kategorien-Enum: `tee_times | experiences | dining | apparel | travel | equipment`,
  Editorial-Felder (title, subtitle, description, image_url, badge, highlight, sort_order),
  Pricing (price_eur_cents + price_label „ab 79 €" / „auf Anfrage"),
  Booking (external_url für Partner-Deeplinks, tee_time_at, available_from/until),
  Lifecycle (status: `active | sold_out | draft | archived`)
- `savor_wishlist` (User kann Angebote favorisieren)
- Storage-Bucket `savor-images` (public-read, admin-write)

### Slug-Trigger
- 8-char Slug für Partner, 10-char Slug für Offers (auto-generiert wenn leer)

### RLS
- Public-Read auf aktive Offers
- Admin-only Write (Rainer-Mail-Gate) — Partner und Offers werden via Admin-Cockpit gepflegt
- Wishlist nur self-access

### Edge Function `public-savor` (3-Modi)
- `?mode=home` — Featured-Liste + Counts pro Kategorie + 3-Item-Preview pro Kategorie
- `?mode=category&category=...&city=...` — Listing mit optionalem Stadt-Filter
- `?mode=offer&slug=...` — Einzel-Detail mit Partner-Join

## F14 — Savor-Home + Category + Detail (3 neue Screens)

### `SavorScreen` (`/savor`) — Editorial Magazin-Home
- Hero: „The Lifestyle" Eyebrow + Fraunces „Savor" Display
- **Featured-Grid** mit 2 Spalten OfferTiles (4:5 Cover, Champagne-Gradient-Overlay, Badge, Price)
- **Categories-Liste** mit Editorial-Hairline-Cards (Icon + Label + Blurb + Count)
- **Per-Category-Preview** mit 3-Spalten-Mini-Tiles (kompakt, 4:3)
- **Empty-State** wenn noch keine Offers seeded — „Curating in progress" Editorial-Statement
- **Partner-CTA** im Footer: „Du bist Pro-Shop, Club oder Marke? partners@swingandsavor.at"

### `SavorCategoryScreen` (`/savor/c/:category`)
- Editorial-Header pro Kategorie mit Blurb
- **Stadt-Filter** für `tee_times`, `dining`, `travel`
- 2-Spalten-Grid mit großen Tiles
- Empty-State pro Kategorie

### `SavorOfferScreen` (`/savor/o/:slug`)
- Vollflächige 4:5-Hero-Image mit Off-Black-Gradient + Editorial-Title
- 3-Spalten Meta-Strip: Price / Location / Tee Time
- Description (preserves line breaks)
- **Partner-Block** mit Logo + Website + Beschreibung
- 3 CTAs:
  - „Book / Reserve" → Deeplink zur Partner-Page (oder „Sold out" / „Coming soon")
  - „Save" → Wishlist-Toggle (nur eingeloggt)
  - „Share" → Web Share API + Fallback-Modal

## OG-Meta für Savor-Offers
- Vercel-Rewrite für `/savor/o/:slug` an Bot-User-Agents → `/api/og`
- `api/og.js` erweitert um Savor-Offer-Handler: liefert `og:title`, `og:image`,
  `og:type=product`, `og:description` mit Preis + Partner + City
- WhatsApp-/Twitter-Link-Previews zeigen jetzt sofort das Offer-Bild + Titel

## Routing

| Route | Zweck |
|---|---|
| `/savor` | Savor-Home (Featured + Categories + Previews) |
| `/savor/c/:category` | Kategorie-Listing mit Stadt-Filter |
| `/savor/o/:slug` | Offer-Detail mit Booking-CTA |

## Bewusste MVP-Schmälerung

- **Keine Stripe-Payments**: Booking läuft via Deep-Link zur Partner-Page (`external_url`). Provision wird per Affiliate-Tracking (z.B. UTM-Param `?utm_source=swingsavor`) oder manueller Abrechnung erfasst. Phase-2-Kandidat.
- **Keine Seed-Daten**: per Memory-Regel keine Demo-Daten in Production. Empty-State ist editorial gestaltet, kein Catch-Fallback.
- **Admin-Pflegeoberfläche**: Offers werden aktuell direkt via SQL / Supabase-Dashboard angelegt. Eigene Savor-Admin-UI ist Phase 2.

## Was als nächstes Sinn macht

1. **Savor-Admin-UI** im bestehenden `/admin`-Cockpit als neuer Tab „Savor"
2. **Founding-Partner-Pitch**: 5–10 Clubs / 3 Pros / 2 Reise-Ops für initiale Befüllung
3. **Stripe Booking** für Tee Times mit Provisions-Split (sobald 1. echter Partner live)
4. **Push-Notifications** „Neue Tee Times in [deine Stadt]"

## Files

**Neu**: `src/components/ModeSwitch.jsx`, `src/screens/SavorScreen.jsx`,
`src/screens/SavorCategoryScreen.jsx`, `src/screens/SavorOfferScreen.jsx`

**Verändert**: `src/components/BrandHeader.jsx`, `src/components/BottomNav.jsx`,
`src/App.jsx`, `vercel.json`, `api/og.js`

**Edge Function**: `public-savor` v1

**Migration**: `017_savor_marketplace`
