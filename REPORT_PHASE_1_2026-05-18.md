# Phase 1 — Invitational-Page als Hero

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod)

## Was geliefert wurde

### 1. DB-Migration `008_invitational_metadata`
- `tournaments.location_name text` — Free-text Course/Location-Label für den Hero.
- `tournaments.format text` — Spielformat-Label (Match Play, Stableford, Best Ball etc.).
- `tournaments.package_type text` — Enum `free | premium | club | league` (Default `free`). Treibt Eventpage-Styling und Sponsor-Slot in Phase 5.
- Index `tournaments_package_type_idx`.

### 2. Edge Function `public-invitational` (`verify_jwt: false`)
Liefert reiches Hero-Payload für Public-Route `/i/:inviteCode`:
- Cup-Metadaten inkl. `cover_url`, `location_name`, `format`, `package_type`
- Captain (Owner-Profile mit Avatar)
- Participants-Liste mit Avataren, Handle, Team-Zuordnung
- Live-Score + Match-Progress (`matches_finished / matches_total`)
- Nur `visibility = 'public'` Tournaments werden exponiert (private/friends → 403)

### 3. Neuer Screen `InvitationalScreen.jsx`
Editorial Hero-Page nach Anweisungsdokument V2 §10/§12:
- Cover-Foto vollflächig im Hintergrund mit Off-Black-Gradient-Overlay
- Eyebrow-Label: „You're invited" / „Live" / „Hall of Fame" (status-getrieben)
- Riesige Fraunces-Display-Headline (clamp 40–64px, weight 500)
- Datum, Location, Format als Tracking-Caps
- Beschreibung als Editorial-Body mit max-width 460px
- Captain-Avatar + „Captain"-Label
- Package-Badge (Premium/Club/League) als Hairline-Chip mit Champagne-Dot
- The Lineup: Teams nebeneinander, jeder Spieler mit Avatar (28px)
- Live-Score-Banner mit Fraunces-Tabular-Nums (44px)
- CTA-Stack: „I'm in" Champagne-Solid + „Share" Hairline
- Powered-by-Swing-&-Savor Footer

### 4. Routing
- `/i/:inviteCode` neu hinzugefügt zu App.jsx (lazy-loaded)
- `/c/:inviteCode` (Legacy) bleibt erhalten — alte Share-Links brechen nicht
- `isPublicCup` Guard erkennt beide Prefixe
- Alle neuen Cup-Shares (CupScreen.jsx) generieren `/i/`-Links mit `cup`-Variable im Share-Text

### 5. Komponenten-Beilagen
- `Avatar` (lokal in Screen): Bone-Border, Initials-Fallback in Fraunces
- `PackageBadge`: Hairline-Chip mit Champagne-Dot, Uppercase 0.28em Tracking
- Cover-Hero mit `pointer-events-none` + Off-Black-Gradient (78% Übergang)

## Akzeptanz-Marker (laut V2 §18)

| Kriterium | Status |
|---|---|
| Eventpage sieht ohne Erklärung hochwertig aus | ✓ Editorial Hero, Cover-Foto-Mode, große Display-Typo |
| Spieler kann per Link in <60s beitreten | ✓ Single-Tap „I'm in" → /home (Auth-Flow ist 8-digit Code) |
| Event kann mind. 16 Spieler abbilden | ✓ Lineup-Grid skaliert |
| Cup-Status `active` / `finished` korrekt | ✓ Live-Banner + Final-Stand differenziert |
| Memory-Regel keine Demo-Daten in Prod | ✓ RLS via `visibility = public` + service-role im Edge-Function |
| Build grün | ✓ |
| Deploy auf swingandsavor.at | ✓ |

## Bekannte Lücken (für spätere Phasen)

- Cover-Upload-UI für Captains existiert noch nicht (Cover wird via DB / Admin gesetzt). → Phase 5 / Admin.
- Format / Location-Inputs im Cup-Erstellen-Formular fehlen. → Phase 5 (Premium-Editor).
- WhatsApp-Direct-Link mit Pre-filled Text fehlt — `ShareSheet` deckt es ab, aber Phase 2 fügt expliziten WhatsApp-Button.
- QR-Code-Generator für Eventpage (Tischaufsteller) → Phase 5 (Club Cup).

## Nächste Phase

Phase 2: Winner Cards + **Strava-Style Story Overlay** (transparente PNG für IG-Story über eigenes Foto).
