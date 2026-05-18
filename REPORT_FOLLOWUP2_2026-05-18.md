# Follow-Up Welle 2 — F5 bis F11

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod, mehrfach)

User-Feedback war: „dunkles grün war für golf mega leider weg", „logo ist auch weg", „nau alle phasen nach und nach fertig". Diese Welle räumt beides auf + schließt V2 §11 komplett ab.

---

## F5 — Forest-Green Palette + Logo zurück

### Tokens (tailwind.config.js + index.css)
| Token | Vorher (Off-Black) | Jetzt (Forest Green) |
|---|---|---|
| `bg` | `#0A0A0A` | `#0A1A12` (Forest-Black) |
| `surface` | `#141414` | `#102822` (Moss-on-Shadow) |
| `surface2` | `#1C1C1C` | `#16332B` |
| `line` | `#2A2A2A` | `#1F4537` (Moss-Hairline) |
| `lineSoft` | `#1F1F1F` | `#15302A` |
| `inkMuted` | `#9C968C` | `#9CAFA4` (sage-tinted bone) |
| `inkDim` | `#5C5851` | `#5C7068` |
| `accent` | `#D9C9A8` | `#D9C9A8` (Champagne bleibt) |
| `course` (neu) | — | `#5C9A6E` (Fairway-Green für „live" Dots) |

### Logo zurück
- BrandHeader: Logo `/logo.png` 32×32 + „Swing & Savor"-Wordmark + „The Clubhouse"-Subline
- SignInScreen: Logo 56×56 mit Champagne-Hairline-Glow als Hero
- InvitationalScreen + RecapScreen + HallOfFameScreen + CrewScreen + SeasonScreen: alle Editorial-Header zeigen jetzt Logo links neben Wordmark
- OnboardingScreen: Logo 64×64 + „Welcome to the Clubhouse"-Eyebrow + Fraunces-Headline

### Bulk-Refactor in 16 Dateien
- Alle hartcodierten `#0A0A0A` / `#141414` / `#1C1C1C` / `#2A2A2A` / `#1F1F1F` Hex-Werte ersetzt
- WinnerCard-Renderer + ShareCard-Renderer + OG-Edge-Function nutzen jetzt Forest-Green-Backgrounds
- Custom Live-Pulse-Keyframe-Animation `.live-pulse` für Course-Green-Glow

---

## F6 — QR-Code Einladung

### Library
- `qrcode` (npm, ~16kb gzip) installiert
- Pure Canvas 2D Rendering, kein Server-Roundtrip

### Komponente `src/components/QrCodeSheet.jsx`
- 1080×1440 Print-Ready PNG-Poster
- Layout: Eyebrow „YOU'RE INVITED" / Hairline-Rule / Fraunces Cup-Name (Wraps automatisch) / Datum + Location-Subline / großer QR (720px, Champagne-Tile, Error-Correction H) / Logo-Overlay zentriert mit weißer Backdrop + dunklem Inner-Frame / „Scan to join the Invitational"-CTA / S·S-Monogramm / swingandsavor.at-Footer
- Download als PNG + Native Web-Share-API
- Druckbar als A4-Tischaufsteller oder iPad-Standee

### Integration in CupExtrasSheet
- Vierter Tab „QR" zusätzlich zu Cover / Awards / Sponsor
- Captain öffnet via Cog-Icon → 1-Klick zum Poster

---

## F7 — Team Identity (Logo + Color)

### DB-Migration `013_team_identity`
- `tournaments.team_a_color` / `team_b_color` (Hex)
- `tournaments.team_a_logo_url` / `team_b_logo_url`
- 4 neue Felder in den Edge-Functions `public-invitational` und `public-recap` exponiert

### Captain-UI: TeamsTab in CupExtrasSheet
- Pro Team eine Editorial-Karte mit:
  - Name-Input
  - Farb-Picker mit 10 Presets + Custom-Color-Input
  - Logo-Upload zu `cup-covers` Bucket
  - Live-Preview-Tile (zeigt wie Logo erscheint)
- „Save Team Identity"-CTA in Champagne

### Sichtbar in
- InvitationalScreen Lineup: Team-Logo + Team-Color als Label-Color
- InvitationalScreen Live-Score: Team-Color für Team-Name + Score-Color für Leader
- RecapScreen Final-Score: Team-Logo + Team-Color (links/rechts gespiegelt)

---

## F8 — Community / Crew Groups (V2 §11)

### DB-Migration `014_community_groups`
- `community_groups` mit `slug` (8-char auto-generated), `type` (`crew | club | company | city`), `region`, `visibility`, `cover_url`, `description`
- `community_group_members` mit `role` (`captain | member | guest`)
- `tournaments.group_id` als FK
- Vollständiges RLS-Set: Members können sich selbst joinen, Owner kann managen, Public kann lesen

### Edge Function `public-crew`
- Group-Profile, Captain, Members (mit Profile-Avatars), Stats, Champion-Tally, Cups-Liste (Active + Legacy)

### Neuer Public-Screen `CrewScreen.jsx` (`/crew/:slug`)
- Editorial Hero mit Cover-Foto, Type-Label, Region/Member-Count
- 3-Spalten-Stats (Cups / Live / Champions)
- Members-Grid mit Avataren + Captain-Badge
- Active + Legacy Cups-Listen
- Share-CTA

### Routing
- `/crew/:slug` als Public-Route
- `isPublicCup` Guard erweitert
- OG-Middleware liefert Crew-Meta für Crawler

---

## F9 — Rivalries-Mechanik (V2 §11)

### DB-View `rivalries`
- Computed View aggregiert finished Matches zwischen Profile-Pairs (unabhängig vom Cup)
- Pro Pair: `matches_total`, `wins_low`, `wins_high`, `draws`, `last_clash_at`
- Funktioniert für Singles, Doubles und Flights via Cartesian-Product über `team_*_player_ids`

### Edge Function `public-rivalries`
- Input: Handle eines Players
- Output: Liste seiner Top-50 Rivalries mit Opponent-Profile + W/L/D + Lead-Indikator

### UI-Integration in HallOfFameScreen
- Neue „Rivalries"-Section unter Cups
- Top-10 Head-to-Head mit Opponent-Avatar + W–L Display (Champagne wenn führend, Bone wenn neutral, gedeckt wenn hinten)
- Optionaler Draws-Indicator („·N")

---

## F10 — Seasons / City Cups (V2 §11)

### DB-Migration `016_seasons`
- `seasons` mit `slug`, `starts_on`/`ends_on`, `type` (`season | league | city_rivalry | tour`), `scoring` (`cups_won | points | aggregate`), `cover_url`, optional `group_id` FK
- `tournaments.season_id` als FK

### Edge Function `public-season`
- Season-Metadaten + Captain + Group + Stats
- **Auto-Standings**: 3 Punkte für Win, 1 für Draw, sortiert
- Cups-Schedule chronologisch

### Neuer Public-Screen `SeasonScreen.jsx` (`/season/:slug`)
- Editorial Hero
- 3-Spalten-Stats (Cups / Played / Upcoming)
- **Standings**: Ranked-Liste mit Top-3-Champagne-Color-Hierarchy + Punkte
- Cup-Schedule mit Click-through zu Invitational / Recap
- Share-CTA + OG-Middleware

---

## F11 — Code-Review + UX-Polish

### Code-Cleanup
- Keine TODO/FIXME/XXX-Marker
- console.warn/console.log nur in benignen Recovery-Pfaden (OnboardingScreen, courses.js) — bleiben für Debug-Hilfe
- Keine ungenutzten Imports gefunden

### Visual-Sweep
- **OnboardingScreen**: Editorial-Refresh mit Logo + „Welcome to the Clubhouse"-Eyebrow + Fraunces-Headline
- **HomeScreen Team-Colors**: `#60a5fa` (Blue) / `#fb7185` (Pink) → `#9BB5C9` (Sage-Blue) / `#D9A38E` (Sand-Rose) — gedeckt-lifestyle statt knallig
- **HomeScreen CUP_HUES**: Bunt-Palette (orange/violet/cyan/magenta) → gedeckt-elegant (Champagne, Course-Green, Sage-Blue, Champagne-Deep, Moss, Mauve, Honey, Tan)
- **MatchDetailScreen Team-Colors**: gleiche Anpassung
- Alle `rgba(96,165,250)` (Blau) und `rgba(251,113,133)` (Pink) bulk-replaced

### Was bewusst NICHT verändert wurde
- Bestehende Code-Patterns (z.B. SocialBar, CourseEditor) sind funktional & nicht im V2-Fokus
- console.warn-Logs bleiben (keine User-sichtbaren Effekte, sinnvoll für Debug)

---

## Gesamtstand nach Welle 2

| V2 §11 / Lücke aus Phase-6-Report | Status |
|---|---|
| QR-Code Einladung | ✓ F6 |
| Team Identity (Logo + Color) | ✓ F7 |
| Community/Crew Groups | ✓ F8 (DB + Public Crew-Page) |
| Rivalries-Mechanik | ✓ F9 (View + Public Endpoint + Hall-Integration) |
| Seasons / City Cups | ✓ F10 (DB + Standings + Public Season-Page) |
| Brand-Reset Forest-Green + Logo | ✓ F5 |
| HomeScreen Team-Colors entschärft | ✓ F11 |
| OnboardingScreen editorial | ✓ F11 |

## Was weiter offen (außerhalb des V2-MVP-Scopes)

- **Crew-Creator-UI** (Captain legt Crew via App-Form an) — aktuell via Admin/SQL
- **Season-Creator-UI** (Cups einer Season zuordnen) — aktuell via Admin/SQL
- **Native iOS/Android-Resubmission** mit neuer Forest-Green-Bundle
- **Stripe-Secrets-Setup in Supabase** (steht weiter aus, manuelle User-Aktion)
- **Server-Side Push-Notifications** beim Cup-Start / Recap-Ready

## Edge Functions live (8)
- `public-invitational` v3 (Team-Identity inkludiert)
- `public-recap` v3
- `public-hall` v1
- `public-crew` v1
- `public-season` v1
- `public-rivalries` v1
- `create-premium-checkout` v1
- `stripe-webhook` v1

## DB-Migrations live (9 neue)
008 — Invitational-Metadata · 009 — Awards · 010 — Premium + Sponsors · 011 — Ambassador-CRM · 012 — Storage-Buckets · 013 — Team-Identity · 014 — Community-Groups · 015 — Rivalries-View · 016 — Seasons

## Deploys (in dieser Welle)
- 4× Vercel Production (F5 → F6+F7 → F8+F9+F10 → F11)
- alle gegen `app.swingandsavor.at` aliased
