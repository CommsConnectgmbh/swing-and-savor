# Phase 3 — Recap als digitales Magazin

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod)

## Was geliefert wurde

### 1. DB-Migration `009_recap_awards`
Neue Tabelle `awards`:
- `award_type` Enum: `champion | runner_up | longest_drive | closest_to_pin | mvp | rivalry | custom`
- `recipient_profile_id` (FK profiles) oder `recipient_name` (Free-Text)
- `title`, `description`, `recipient_team`
- RLS: Public-Read für public Cups, Insert/Update/Delete nur für Cup-Owner

### 2. Edge Function `public-recap`
Liefert reiches Recap-Payload:
- `cup` mit aggregiertem `score_a/score_b`, `champion`, `cover_url`, `location_name`, `format`
- `captain` (Owner-Profile)
- `participants` (Lineup mit Avatars + Handle + Team)
- `finished_matches` (mit Player-Names aus Profile-Display-Name oder Player-Name-Fallback)
- `photos` (alle Match-Cover-Photos, max 12)
- `awards` (mit Profile-Daten resolved)

### 3. Neuer Public-Screen `RecapScreen.jsx` (Editorial Magazine)
Route: `/recap/:inviteCode`

Sections (Editorial Flow):
1. **Hero** — Cover-Foto mit Off-Black-Gradient (Top 560px), Eyebrow „The Recap · Vol. {year}", Champion-Headline „Champion · {name}" (Champagne, 76px Fraunces)
2. **Final Leaderboard** — Hairline-Card mit großen Tabular-Nums (56px Fraunces)
3. **Awards** — 2-Spalten-Grid mit Hairline-Cards: Champion / Longest Drive / Closest to Pin / MVP / Rivalry / Custom
4. **Photos** — 2-Spalten-Grid mit aspect-square Tiles
5. **Lineup** — Team-A vs Team-B Liste mit Avataren
6. **Captain's Note** — Captain-Avatar + Name + Handle als Editorial-Block
7. **Next Edition CTA** — Fraunces-Headline „Sicher dir deinen Platz für die nächste Edition" + Story-Overlay-Button + Share-Button

### 4. OG-Meta-Patching (Client-Side)
Beim Laden patcht der Screen `og:title`, `og:description`, `og:image`, `og:type`, `og:site_name`. Das hilft bei Re-Shares zwischen Apps die JS rendern (Twitter Cards Validator, WhatsApp-Link-Preview nach erstem Hit).

**Bekannte Limitation**: First-time-Crawler ohne JS bekommen die Default-Index-OG-Tags. Phase 7 wird das via Edge-Middleware lösen.

### 5. Routing
- `/recap/:inviteCode` als Public-Route (kein Login)
- `isPublicCup` Guard erweitert
- Lazy-loaded via `React.lazy`

### 6. WinnerCardSheet-Integration
Story-Overlay-CTA prominent auf der Recap-Page → Spieler kann sein eigenes Foto + Stats-Overlay sofort posten.

## Akzeptanz (laut V2 §10/§14)

| Kriterium | Status |
|---|---|
| Recap fühlt sich an wie digitales Magazin-Recap | ✓ Editorial Flow, Fraunces-Headlines, Hairline-Dividers |
| Recap wird automatisch erzeugt | ✓ Edge-Function aggregiert on-demand |
| Permanente Public-URL | ✓ `/recap/:inviteCode` |
| Awards block (Honour-System) | ✓ Tabelle + UI |
| Verlinkung zur „nächsten Edition" | ✓ Bottom-CTA |
| Build grün + Deploy | ✓ |

## Nächste Phase

Phase 4: Hall of Fame light + Trophy-Wall im Profile.
