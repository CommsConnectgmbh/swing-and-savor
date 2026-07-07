# Casual: Live-Stand + Match-Play + Home-Feed-Sichtbarkeit (2026-06-09)

## Auslöser
Rainer hat 2026-06-08 in Feldafing 18 Loch gegen Ulrich Winkler gespielt,
die Runde im Casual-Modus angelegt und beendet. Drei Beschwerden:

1. „Ich sehe das Spiel nicht."
2. „Keine pro Loch Vorgabe."
3. „Wie gut stehe ich gerade, 3 über oder so? Wieviele Löcher gewonnen?"

## Diagnose
- Runde `73f60f83-058f-4fe7-bd3a-2ab781c5c5a3` existiert komplett in der DB:
  Feldafing, Rainer (HCP 34) vs Ulrich Winkler (Gast, HCP 0), 36 Scores.
- `casual_rounds.hole_pars = []` und `hole_handicaps = []` — Course
  „Golfplatz Feldafing" hat in der Course-DB selbst keine 18-Loch-Werte
  (OSM-Seed liefert sie nicht). Ohne Par+SI → kein +/-Par, keine Vorgabe.
- HomeScreen-Feed lädt nur aus `matches`, nie aus `casual_rounds`.
  Rainer hat im Home-Tab gesucht, die Runde lag im separaten /casual-Tab.
- Casual-Detail-View hatte keinen prominenten Live-Stand, keine
  Pro-Loch-Vorgabe und keinen Match-Play-Counter.

## Lösung (Commit `e431749`, deployed via Vercel auto)

### `src/lib/scoring.js`
- `strokesPerHole(hcp, hcps)` — verteilt HCP-Schläge nach SI.
  Bsp HCP 34, 18-Loch: jedes Loch +1, dazu SI 1–16 zusätzlich +1
  → 16 Löcher mit ••, 2 Löcher mit •.
- `holeWinnerNet(strokesA, strokesB, addA, addB)` — Netto-Sieger pro Loch.
- `calcCasualMatchStanding(scoresByHole, strokesA, strokesB)` — gibt
  `{ upA, upB, halved, played, leader, label, remaining }` zurück.
  Label wie `2 Up`, `All Square`, oder Dormie-Style `3&2`.

### `src/screens/CasualScreen.jsx`
- `LiveStanding`-Block oberhalb der Scorecard:
  pro Spieler Brutto-Total groß + farbiges Brutto/Netto-Diff zu Par.
  Bei 2 Spielern zusätzlich Match-Play-Zeile mit Führendem, Pillen-Label
  und Zähler `↑ · ↓ · ↔`.
- Scorecard hat neue Zeilen: `Par`, `SI`, `Vor` (pro-Spieler Punkte
  •/••/••• für 1/2/3 HCP-Strokes pro Loch). Vor-Zeile nur wenn SI
  vorhanden und HCP > 0.
- Gelbe `Par+SI fehlt`-Karte mit `Nachtragen`-Button, wenn arrays leer.
- Neues `CourseSetupSheet`: pro Loch Par (3–6) und SI (1–18) editierbar,
  Pflicht-Validierung dass SI jede Zahl 1..18 genau einmal enthält.
  Speichert direkt in `casual_rounds.hole_pars/hole_handicaps`, kein
  Eingriff in `courses` (jede Runde kann ihre eigene Variante haben).
- Deeplink `/casual/:roundId` öffnet direkt den Detail-View (Route
  existierte schon, war aber nicht verkabelt).

### `src/screens/HomeScreen.jsx`
- Lädt parallel `casual_rounds` (Top 8, RLS regelt Sichtbarkeit),
  joint Player-Namen und Score-Count.
- Neue `CasualSection`-Komponente unter dem Filter, über den
  Cup-Groups. Zeigt Top 5 mit Status-Pulse, Spieler-Namen, Datum,
  Course und Fortschritt %. Klick → `/casual/:id`.
- Realtime-Subscription erweitert um `casual_rounds` + `casual_scores`.
- Filter (mine/friends) gilt auch für die Casual-Sektion.

## Was Rainer jetzt tun muss
Einmalig die Feldafing-Runde öffnen — über die neue Home-Sektion oder
den /casual-Tab — und im Loch-Setup-Sheet die echten Feldafing-Par-
und SI-Werte eintragen. Sobald gespeichert:

- Brutto: Rainer 110 (+...), Ulrich 104 (+...) je nach echter Par.
- Netto: Rainer −0 (HCP 34), Ulrich +... (HCP 0).
- Match Play (Netto): Sieger über alle 18 Löcher mit `X Up`-Label und
  Pro-Loch-Aufschlüsselung in den HCP-Strokes.

Backfill durch mich wurde bewusst nicht gemacht — Memory-Regel
„Niemals Schätzungen" gilt auch für Course-Daten.

## Deploy
- Commit `e431749` auf `main`, gepusht 2026-06-09.
- Vercel-Project `swingandsavor-app` baut automatisch von `main`.
- Capacitor-iOS/Android laden remote → keine neuen Store-Builds nötig.
