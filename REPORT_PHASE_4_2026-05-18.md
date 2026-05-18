# Phase 4 — Hall of Fame light

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod)

## Was geliefert wurde

### 1. Edge Function `public-hall`
Liefert die Karriere eines Captains öffentlich via Handle:
- Captain-Profile (display_name, avatar, home_club, country_code, member_since)
- Stats: `cups_total`, `cups_finished`, `cups_active`
- Champion-Tally: Wie oft hat jedes Team-Name unter diesem Captain gewonnen?
- `finished_cups` + `active_cups` mit aggregierten Scores + Champion-Name

### 2. Neuer Public-Screen `HallOfFameScreen.jsx`
Route: `/hall/:handle`

Sections:
1. **Hero** — Avatar (88px) neben Display-Name (Fraunces 40px), Handle/Club/Since-Subline
2. **3er Stat-Row** — Cups / Live / Champions in Fraunces 32px Tabular-Nums
3. **Champion Tally** — Ranked Liste der erfolgreichsten Teams unter diesem Captain (Champagne-Nummerierung)
4. **In Play** — Aktive Cups als Cup-Row Editorial (Click → `/i/:slug`)
5. **Legacy** — Finished Cups (Click → `/recap/:slug`)
6. **Share-CTA**

### 3. Trophy-Link in ProfileScreen
Editorial Hairline-Karte direkt unter Profile-Header → öffentlicher `/hall/{handle}`-Permalink.

### 4. Routing
- `/hall/:handle` als Public-Route
- `isPublicCup` Guard erweitert

## Akzeptanz (laut V2 §11)

| Kriterium | Status |
|---|---|
| Crew-Historie sichtbar | ✓ Active + Legacy als Editorial-Liste |
| Trophy-Wall im Profile | ✓ Hairline-Karte als Permalink |
| Status / Lock-in (Hall) | ✓ Champion-Tally erzeugt Wiederkehr |
| Build grün + Deploy | ✓ |

## Bewusste Vereinfachung

V2 §11 spricht von „Crew/Community" — wir haben aktuell **kein** `community_groups`-Datenmodell. Stattdessen interpretieren wir „Crew" als „Captain's Career": jeder Captain hat seine eigene Hall of Fame.

Wenn später Community-Groups eingeführt werden, kann dieselbe Edge-Function um eine `/hall/group/:slug`-Variante erweitert werden, ohne den User-Hall-Code zu brechen.

## Nächste Phase

Phase 5: Premium Invitational 49€ (Stripe-Checkout für Captains) + Sponsor-Slot light.
