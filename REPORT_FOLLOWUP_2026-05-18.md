# Follow-Up Wave — F1 bis F4

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod, mehrfach)

Diese Welle schließt die im Phase-6-Report markierten Lücken.

## F1 — Format + Location im Cup-Creator-Form

**CupScreen.jsx**
- `emptyForm` erweitert um `location_name`, `format`, `description`, `cover_url`
- Neue Form-Felder beim Cup-Erstellen + Bearbeiten:
  - **Location** (free-text Course/Venue, z.B. „Pebble Beach")
  - **Format** als Pill-Chip-Selector: Match Play / Stableford / Best Ball / Scramble / Stroke Play / Texas Scramble
  - **Beschreibung** (Editorial-Body, optional)
  - **Cover-Bild-URL** mit Live-Preview-Karte (zeigt sofort wie es auf der Invitational-Page wirkt)
- `openEdit` und `handleSubmit` lesen/schreiben die neuen Felder

## F2 — Captain-Self-Service Sheet (Cover-Upload + Awards + Sponsor)

### DB
**Migration `012_cover_and_sponsor_logos_bucket`**
- Storage-Buckets `cup-covers` und `sponsor-logos` (beide public)
- RLS-Policies: Insert/Update/Delete nur für authentifizierte User (Captain selber)
- Public-Read auf beiden Buckets für die Hero-/Recap-Anzeige

### Komponente
**`src/components/CupExtrasSheet.jsx`** — Bottom-Sheet mit 3 Tabs:

1. **Cover-Tab**
   - File-Upload direkt aus dem Sheet → `cup-covers/<cup_id>/cover-<ts>.<ext>`
   - Direkte Public-URL-Generierung
   - `tournaments.cover_url` Update
   - Live-Preview mit Off-Black-Gradient-Overlay (zeigt finalen Look)
   - „Remove Cover"-Button

2. **Awards-Tab**
   - 7 Award-Typen via Dropdown: Champion / Runner-Up / Longest Drive / Closest to the Pin / MVP / Rivalry / Custom
   - Inline-Form: Award-Titel + Empfänger-Name + Beschreibung
   - Liste mit Inline-Delete (×)

3. **Sponsor-Tab**
   - Inline-Form: Sponsor-Name + Website + Logo-Upload (direkt zu `sponsor-logos` Bucket)
   - Logo-Preview während des Anlegens
   - Auto-Insert in `sponsors` + `sponsor_placements` (`placement_type: powered_by`)
   - Aktive Sponsoren-Liste mit Inline-Remove (soft-delete via `status: removed`)

### Wire-Up in CupScreen
- Settings-Cog-Icon (SVG-Gear) pro Cup-Row, nur sichtbar für Cup-Owner
- Öffnet `CupExtrasSheet` mit dem Cup als Prop
- `onChanged` callback triggert `loadTournaments` für Live-Refresh

## F3 — Server-Side OG-Meta für Social-Crawler

### Vercel Edge Function `api/og.js`
- Runtime: `edge`
- Erkennt drei Routen-Typen: `/i/:slug`, `/recap/:slug`, `/hall/:handle`
- Fetcht Live-Daten von den Supabase Edge-Functions (`public-invitational`, `public-recap`, `public-hall`)
- Generiert vollständig OG-/Twitter-Card-stuffed HTML mit:
  - `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name`
  - `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
  - Editorial-Mini-Page mit Champagne-Eyebrow + Fraunces-Headline als Body-Fallback
- Cache-Header: `public, s-maxage=900, stale-while-revalidate=3600`

### Vercel-Routing (`vercel.json`)
- Drei neue `rewrites`-Einträge mit `has`-Matcher auf `user-agent` Header
- Bot-Regex matcht: `facebookexternalhit`, `whatsapp`, `twitterbot`, `slackbot`, `linkedinbot`, `telegrambot`, `discordbot`, `skypeuripreview`, `pinterest`, `googlebot`, `bingbot`, `applebot`, `embedly`, `redditbot`
- **Real users → unchanged**: SPA wird normal ausgeliefert
- **Bots → /api/og** mit Pfad als Query-Param

### Verifiziert
```bash
$ curl -A "facebookexternalhit/1.1" https://app.swingandsavor.at/i/abcd1234
# → liefert vollständig OG-stuffed HTML

$ curl -A "Mozilla/5.0 (iPhone)" https://app.swingandsavor.at/i/abcd1234
# → liefert die normale SPA index.html
```

WhatsApp-/Twitter-Link-Previews zeigen jetzt beim ersten Hit den Cup-Namen + Cover-Bild + Champion-Description.

## F4 — HomeScreen + LeaderboardScreen Editorial-Refactor

### HomeScreen
- **Header**: Eyebrow „The Clubhouse" (Champagne, 0.42em Tracking) + Fraunces-Display-Headline „Live Feed" / „On the Tee" (clamp 36–52px, weight 500)
- Sub-Caption in Inter-Caps mit Live-Count + Crew-Live-Indikator
- **Filter-Pills**: Hairline-Style statt grünen Pills, Champagne-Solid für Active
- **Tour-Button**: Hairline rechtsbündig
- Hairline-Border zwischen Header und Filters

### LeaderboardScreen
- **Header**: Eyebrow „The Order" + Fraunces „Leaderboard" Editorial-Titel
- Subline „ELO · Match Play · Higher = better" als Tracking-Caps
- **My Standing**: Hairline-Card statt Surface-Border, Fraunces-Tabular-Nums für Rank + ELO
- **Liste**: Hairline-Border-Bottom statt Card-Border, Rank-Farben jetzt im Champagne-Spektrum (Top-3: Champagne / Bone / Champagne-Deep statt Gold/Silber/Bronze)
- **Empty-State**: Fraunces „No order yet." Editorial-Style

## Gesamtstatus nach Follow-Up

| Lücke | Vorher | Jetzt |
|---|---|---|
| Format/Location im Cup-Form | ✗ | ✓ |
| Cover-Upload self-service | nur via Admin/SQL | ✓ in CupExtrasSheet |
| Awards-Editor self-service | nur via SQL | ✓ in CupExtrasSheet |
| Sponsor-Picker self-service | nur via SQL | ✓ in CupExtrasSheet |
| OG-Meta für Crawler (WhatsApp/Twitter Link-Previews) | Default-Tags | Live-fetched, on-brand HTML |
| HomeScreen editorial | nur token-getuned | Fraunces-Headlines + Hairlines |
| LeaderboardScreen editorial | nur token-getuned | Fraunces-Headlines + Hairlines |

## Was weiter offen bleibt (bewusst nicht in dieser Welle)

- Community/Crew als eigenes Datenmodell (V2 §11 „Mittel-Prio")
- Team Identity (Logo, Color, Captain-Role-Trennung) — V2 §11
- Rivalries als dedicated Mechanik (nicht nur sprachlich) — V2 §11 Mittel
- Seasons / City Cups — V2 §11
- QR-Code Einladung — V2 §11
- HomeScreen FeedCard-Body — funktional ok, könnte mit eigenem Editorial-Refactor noch ruhiger werden (z.B. Score-Pill in Champagne, Cup-Hue weg)
- Native iOS/Android (Capacitor): nicht neu submitted, lädt remote (sollte funktionieren)
- Stripe-Secrets-Setup steht weiterhin als User-Aktion offen
