# Swing & Savor — Pivot zu Social-Home + zentraler FAB (2026-05-17)

**Trigger:** Rainer: „so ganz macht doch die logik noch kein sinn … man braucht doch als erstes eine home seite und kein board … dann ein plus für neue matches … es soll eine millionen golf app werden!"

**Schritt 1+2 der Vision** (Home-Feed + Plus-FAB) ist live. Schritte 3–6 (Messaging, globale Rangliste, Match-Sichtbarkeit pro Match, Foto-Upload, Team-Templates) bewusst nicht angefangen, kommen wenn 1+2 sich gesetzt haben.

## Was Rainer jetzt sieht

### Default-Tab = Home (war Board)

`/` redirected jetzt nach `/home` statt `/board`. BoardScreen bleibt erreichbar (z.B. von Cup-Karten aus), ist aber nicht mehr die Landing-Page.

### HomeScreen — Live-Feed

**Header:** Live-Counter „X Matches gerade live · Y bei Freunden" (oder „Was deine Freunde gerade spielen.").

**3 Filter-Chips:** Alle · Freunde · Eigene. Die Freunde-Chip zeigt den Live-Count direkt mit an, wenn welche aktiv sind.

**Feed-Cards:**
- Match-Typ (`Singles` · `Doubles` · `Flight 4v3`) + Owner-Handle (`@rainer`)
- Live-Dot + Status (`Live` · `Beendet`)
- Spielernamen (groß, gefärbt nach Team) — kommt aus den neuen `team_x_player_ids`-Arrays, funktioniert für Singles bis 4er-Flights
- Score-Box mittig:
  - Live → aktuelles Match-Play-Standing (`3 UP` in Leader-Farbe)
  - Beendet → Sieger-Teamname (oder `A/S` bei Halved)
- Subline: `Loch 7 · GC Eichenried` (oder Cup-Name als Fallback)
- Tap → `/matches/:id` (MatchDetail-Screen, unverändert)

**Realtime:** Subscribe auf `matches` + `hole_results` → Feed aktualisiert sich von selbst, wenn jemand ein Loch einträgt.

**RLS sorgt für Privacy:** Pulls aus `matches` joinen `tournaments` — und die bestehende `can_view_tournament()`-Policy lässt nur public + friends-of-owner + own durch. Keine extra Privacy-Logik im Client nötig.

### BottomNav umgebaut — 5 Slots mit zentralem FAB

Alt:    `Board · Entdecken · Duelle · Matches · Profil`
Neu:    `Home · Duelle · [+] · Matches · Profil`

Der `[+]` ist ein raised FAB in Brand-Cyan-Grün mit Glow-Shadow — visuell der dominanteste Punkt der Nav. Hit-Target 56×56.

**Tap → CreateSheet** (Bottom-Sheet, slide-up, Backdrop-Tap zum Schließen, ESC-Key supported):
1. **Neues Match** → `/matches?new=1` → Form öffnet sich automatisch
2. **Neues Duell** → `/challenges?new=1` → Create-Form öffnet sich automatisch
3. **Neues Turnier** → `/cup?new=1` → Form öffnet sich (war schon implementiert)

Jede Aktion hat Icon + Title + Subline. Tap → schließt Sheet → routet.

### Discover bleibt erreichbar

`/discover` route bleibt aktiv (Join-by-Code geht weiter, alte Bookmarks funktionieren), nur nicht mehr in der Nav. Der nächste Iterationsschritt würde Discover-Funktionen (Join-Code, öffentliche Turnier-Liste) in den Home-Tab integrieren oder unter einen Filter/Tab schieben.

## Schritte 3–6 aus dem Plan (offen, bewusst)

| # | Was | Warum noch nicht |
|---|-----|------------------|
| 3 | Messaging-Tab (1:1 DM Realtime) | Eigenes Schema + Realtime + Push + Spam-Schutz. Lohnt erst, wenn Feed Traction hat. |
| 4 | Globale Rangliste (ELO + HC-gewichtet) | Braucht echte Daten + Anti-Cheat. Bei niedriger Userzahl ist die Rangliste trivial und entmotivierend. |
| 5 | Match-Sichtbarkeit pro Match (statt nur Turnier-Ebene) | Schema-Migration auf `matches.visibility`, RLS-Policy-Update, UI in MatchesScreen. Tagesaufgabe. |
| 6 | Foto-Upload pro Match | Supabase-Storage-Bucket + Image-Pipeline + Card-Layout-Variante. Schnell, aber visueller Pivot. |
| Team-Templates | „Mein Stammflight" wiederverwenden | Schema `team_templates` + Picker in MatchesScreen. |

Sag „mach Schritt X" und ich nehme den nächsten.

## Verifikation

- `npm test -- --run` → 14/14 grün
- `npm run build` → 9.8 s, sauber, neuer HomeScreen-Chunk wird lazy-loaded
- Commit `ed6326b` auf `main` gepusht → Vercel Auto-Deploy zieht
- Native-Wrapper (Capacitor) lädt remote → kein Native-Rebuild nötig

## Smoke-Test

1. App neu öffnen → landet auf `/home` (nicht mehr `/board`)
2. Live-Feed zeigt alle sichtbaren aktiven + beendeten Matches
3. Filter `Freunde` → nur Matches von befreundeten Ownern
4. Filter `Eigene` → nur eigene Matches
5. Zentrales `[+]` tappen → Bottom-Sheet öffnet
6. „Neues Match" → landet in MatchesScreen, Create-Form ist offen
7. „Neues Duell" → ChallengesScreen, Create-Form offen
8. „Neues Turnier" → CupScreen, Create-Form offen
9. Live-Match in einem zweiten Browser-Tab updaten → Home-Feed im ersten Tab aktualisiert sich automatisch (Realtime)

— Claude Opus 4.7 (1M)
