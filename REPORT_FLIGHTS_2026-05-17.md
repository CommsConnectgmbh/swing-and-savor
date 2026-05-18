# Swing & Savor — Flights + Teams-UX (2026-05-17)

**Trigger:** Rainer: „bei der golf app haben wir noch probleme wo kann ich die teams erstellen warum kann ich nicht 4er gegen 4er flight machen? oder auch 4er gegen 3 und dann faktoren."

## Diagnose vor dem Fix

1. **Teams kaum auffindbar.** Route `/teams` existierte, war aber nicht in der BottomNav. Einziger Pfad: Profil → Quick-Link „Teams". Bei einer neuen App ist das genau dort, wo niemand sucht.
2. **Match-Typ hartcodiert auf `singles`/`doubles`.** Schema (`team_a_player1_id`, `team_a_player2_id`, …) erlaubte technisch maximal 2 vs 2.
3. **Keine Faktor-Logik.** Asymmetrische Flights (3 vs 4, 2 vs 4) hätten den größeren Team automatisch bevorzugt — kein Ausgleich möglich.

## Was jetzt drin ist

### Datenmodell (Migration 004)

`matches` bekommt:

| Spalte | Typ | Zweck |
|---|---|---|
| `team_a_player_ids` | `uuid[]` | 1..4 Spieler-IDs Team A (Source-of-Truth) |
| `team_b_player_ids` | `uuid[]` | 1..4 Spieler-IDs Team B |
| `team_a_factor` | `numeric(4,2)` default 1.0, check 0.1..5 | Punktefaktor Team A |
| `team_b_factor` | `numeric(4,2)` default 1.0 | Punktefaktor Team B |

- Type-Check erweitert: `singles` | `doubles` | `flight`.
- Bei `type='flight'` zusätzlicher Check: Array-Länge 1..4 pro Seite.
- Backfill aus den Legacy-Spalten beim Migrate, sodass alle bestehenden Matches sofort die Arrays haben.
- Legacy-Spalten (`team_a_player1_id` etc.) bleiben gespiegelt — nichts bricht.

Migration ist **live** auf Supabase `rcqichlyllhwougopfkg` (Pro-Org, eu-central-1).

### MatchesScreen: drei Typen, Chip-Selector, Auto-Faktor

- **Type-Selector**: Singles (1v1) · Doubles (2v2) · Flight (bis 4v4) als 3 gleich große Cards.
- **Bei Flight** erscheinen pro Seite Chip-Selectoren 1 · 2 · 3 · 4. Asymmetrisch erlaubt (z.B. 4 vs 3).
- **Spieler-Slots** dynamisch — bereits gewählte Spieler werden im anderen Slot als „vergeben" disabled.
- **Faktor-Block** klappt bei Flight auf. Bei ungleichen Größen erscheint ein Hinweis und ein `Auto ausgleichen`-Button, der den Vorschlag aus `suggestFactors()` einsetzt (größere Seite bekommt `kleiner/größer`, z.B. 4v3 → A `0.75` / B `1.00`). Faktoren sind manuell editierbar (0.1–5.0).
- **Manuelles Touch trackt** — wenn der User die Faktoren angefasst hat, werden sie nicht automatisch durch neue Größenänderungen überschrieben.

### Auto-Pair erweitert

Statt 2 Buttons (Singles/Doubles) jetzt 3:

- `Singles ×N` — paart alle Spieler 1:1 nach HC.
- `Doubles ×N` — paart 2er-Teams high+low pro Seite, dann nach Durchschnitt cross-team.
- `Flight 4v4` (oder kleiner) — **neu**: legt ein einzelnes Flight-Match mit allen verfügbaren Spielern an, max 4 pro Seite, Faktoren werden bei Ungleichheit automatisch gesetzt.

### Scoring respektiert Faktoren

`calcTeamPoints` multipliziert das Punkte-Resultat jedes Matches mit `team_x_factor`. Damit ist:

- 4v3-Match, Team B (3 Spieler) gewinnt → Team B kriegt **1.00 Punkte**, Team A hätte bei Sieg nur **0.75** bekommen.
- Halved Match in 4v3 → A bekommt `0.5 × 0.75 = 0.375`, B `0.5 × 1.0 = 0.5`.

14 grüne Tests in `scoring.test.js` decken Standard- und Faktor-Pfad ab.

### MatchDetailScreen + BoardScreen lesen aus Arrays

- Spielernamen werden bei Flights aus `team_x_player_ids` über eine separate `players`-Query aufgelöst (Postgres hat keinen sauberen Join über Array-Spalten).
- Typ-Label zeigt `Flight 4v3` statt `Doubles`.
- Faktor-Badge `×0.75/1.00` neben dem Typ, wenn der Faktor von 1.0 abweicht.
- Punkte im Match-Detail-Header und Bottom-Summary sind faktor-gewichtet.

### Navigation: Teams findbar

- **Cup-Karten** haben jetzt eine `Teams`-Pille — tap → `/teams?tid=<cup-id>`, der TeamsScreen wählt das Turnier automatisch vor.
- **MatchesScreen Empty-State**: wenn ein Turnier ohne Spieler existiert, erscheint eine Card mit klarem CTA `→ Zu Teams`.
- **TeamsScreen ohne Turniere**: CTA `+ Turnier anlegen` führt zu `/cup?new=1`.
- BottomNav bleibt bei 5 Tabs (Board · Entdecken · Duelle · Matches · Profil) — Teams sind tournament-scoped, gehören also nicht auf die globale Nav.

### Kleinkram (UX-Sweep)

- CupScreen: tote `t('common.next').slice(0,1) === t('common.next').slice(0,1)`-Bedingung im Header entfernt (war always-true, sah aus wie Migrations-Müll).
- MatchesScreen: Auto-Pair-Buttons jetzt 3-spaltig statt 2-spaltig, Counter (`×N` bzw. `4v3`) auf zweiter Zeile zur besseren Lesbarkeit.

## Verifikation

- `npm test -- --run` → 14/14 grün
- `npm run build` → 9.52 s, sauber, größtes Chunk `supabase` 165 kB / 44 kB gzip
- Supabase-Migration angewendet, neue Spalten in `matches` bestätigt
- Commit `afca377` auf `main` gepusht → Vercel Auto-Deploy `swingandsavor-app` triggert

## Nicht angefasst (bewusst)

- **Match-Play-Logik pro Loch** bleibt unverändert (Strokes Team A vs Strokes Team B). Für Best-Ball-Flights ist das die natürliche Eingabe (User trägt den besten Schlag des Teams ein). Eine echte „Strokes pro Spieler"-Erfassung würde das hole_results-Schema umbauen — ohne dass es Rainer gefordert hätte.
- **PlayerSelect zeigt HC** in der Optionsliste — könnte mit Tap-Karten ersetzt werden, ist aber für eine schnelle Auswahl auf Mobile aktuell besser.
- **Hartcoded BottomNav-Tabs** — Teams nicht aufgenommen, weil tournament-scoped. Wenn Rainer das anders will, in `BottomNav.jsx` Tab tauschen.

## Wie testen (Smoke)

1. Auf `app.swingandsavor.at` einloggen
2. `/cup` → `+ Neues Turnier` → speichern
3. Auf der neuen Cup-Card die `Teams`-Pille tappen → landet auf `/teams` mit dem Cup vorgewählt
4. 8 Spieler anlegen (4 in Team A, 4 in Team B)
5. `/matches` → `+ Match` → `Flight` wählen → Team A `4`, Team B `3` → Faktor-Hinweis erscheint → `Auto ausgleichen` → Team A `0.75`, Team B `1.00`
6. Spieler auswählen → `Match anlegen`
7. Match in Liste tappen → Header zeigt `Flight 4v3` + Faktor-Badge
8. Ein paar Löcher eintragen → Punkte im Score-Hero sind faktor-gewichtet

— Claude Opus 4.7 (1M)
