# Phase 0 — Brand & Language Reset

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod) — Vercel `dpl_B12pmDP297a5sK1mg3aSUbWsvoYJ`

## Was geliefert wurde

### 1. Dark-Luxury-Tokens
- `tailwind.config.js`: Komplette Farbpalette von Apfelgrün-auf-Tannengrün auf Off-Black + Champagne umgestellt.
  - `bg #0A0A0A`, `surface #141414`, `line #2A2A2A`
  - `ink #F4F1EA` (bone), `inkMuted #9C968C`, `inkDim #5C5851`
  - `accent #D9C9A8` (champagne), `accentDeep #A8956A`
  - Team-Farben neu: `teamA #9BB5C9`, `teamB #D9A38E` (gedeckt, lifestyle-tauglich)
  - Legacy-Aliase (`brand`, `brandGreen`, `card`, `border`, `muted`) auf neue Werte gemappt — keine alten Komponenten brechen.

### 2. Typografie-Switch
- Fraunces (Variable Serif, opsz 9..144) als `font-display`.
- Inter als `font-sans` (UI-Body) und Alias auf `font-condensed` (Legacy).
- Barlow + Barlow Condensed entfernt.
- `font-display` Utility-Klasse in `index.css` für Hero-Headlines (Editorial-Look).

### 3. index.css
- Body: Off-Black + Bone-Text.
- Hairline-Utilities (`hairline-b`, `hairline-t`, `hairline`) für editoriale Trennlinien.
- `score-glow` jetzt Champagne (`rgba(217,201,168,0.42)`).
- Scrollbar + Focus-Ring auf Champagne.
- Reduced-Motion-Media-Query.

### 4. Sprache (i18n)
- `de.json` + `en.json` komplett auf Club-Sprache:
  - Tournament → Cup / Invitational
  - Host → Captain
  - Friends → Crew
  - Duels → Rivalries
  - Archive → Hall of Fame
  - Sign in → „Du wurdest eingeladen" / „You've been invited"
  - "Anmelden" → „Einladung anfordern"
- Neue Namespaces `winnerCard` und `recap` für Phase 2/3 vorbereitet.
- Share-Sheet bekommt `instagram` und `storyOverlayCta` für Strava-Style Overlay (Phase 2).

### 5. BrandHeader
- Editorial Wordmark `S·S` (Fraunces, Champagne-Dot) + Tracking-Subline.
- Hairline-Divider (kein grün-getöntes Border mehr).
- Header solid Off-Black, kein Blur (per Memory-Regel für Obacht analog).
- Hover-States auf Champagne, nicht weiß.

### 6. BottomNav
- Solid Off-Black mit Hairline-Top (kein Glass-Blur).
- FAB von Apfelgrün auf Champagne mit Off-Black-Outline.
- Active-State weiterhin in `text-accent` → jetzt Champagne (per Memory-Regel „Brand-Color-Active").

### 7. SignInScreen
- Komplett editorial neu: Hero-Headline Fraunces, max 56px, hairline-Inputs.
- Copy: „Du wurdest eingeladen" + „Premium golf cups. Founder Invitationals. Hall of Fame."
- CTA-Button: Champagne auf Off-Black, Tracking 0.24em uppercase.
- 8-stelliger OTP-Input editorial styled (Fraunces statt Barlow Condensed).

### 8. Index.html
- Theme-Color `#0A0A0A`.
- Meta-Description auf neue Positionierung („Premium Golf Lifestyle Club. Founder Invitationals, Cups, Hall of Fame").
- Google-Fonts-Tag von Barlow auf Fraunces+Inter.

### 9. Bulk-Refactor in Screens
- Hardcoded Grüns ersetzt in `HomeScreen`, `BoardScreen`, `LeaderboardScreen`, `MatchesScreen`, `MatchDetailScreen`, `MessagesScreen`, `TourScreen`, `shareCard.js`.
- `#98cd02 → #D9C9A8`, `#0d271e → #0A0A0A`, `#143024 → #141414`, `#244a37 → #2A2A2A`, `#1a3a2c → #1C1C1C`, `#19362a → #1F1F1F`.
- `rgba(152,205,2,*) → rgba(217,201,168,*)` (Glow-Effekte).
- Greyscale-Refresh: `#6b7a72 → #5C5851`, `#a8b5ad → #9C968C`.

## Akzeptanz (laut Plan §10)

| Marker | Status |
|---|---|
| `npm run build` grün | ✓ (10.72s) |
| Deploy auf swingandsavor.at | ✓ alias `app.swingandsavor.at` |
| Visueller Smoke-Test iPhone-Viewport | offen (User-Pflicht) |
| Report im Projekt | ✓ (diese Datei) |
| Memory-Regeln eingehalten | ✓ (Hochdeutsch, keine Glass/Blur, keine Demo-Daten, kein doppelter Active-Indicator) |

## Was bewusst NICHT in Phase 0 lag

- Logo-Asset bleibt vorerst (`/logo.png`). Wird in Phase 1 durch monogramm-basierte SVG-Wordmark ersetzt.
- Existierende Screens wurden nur farblich getunt, nicht typografisch redesigned (kommt phasenweise: HomeScreen in Phase 1, MatchesScreen in Phase 2, Leaderboard in Phase 3).
- Native iOS/Android Capacitor-Wrapper braucht keine Aktion — er lädt remote.

## Nächste Phase

Phase 1: Invitational-Page als Hero (`/i/:slug` öffentlich, Editorial-Einladung, <60s-Beitritt).
