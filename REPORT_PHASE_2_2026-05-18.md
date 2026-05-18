# Phase 2 — Winner Cards + Strava-Style Story Overlay

Datum: 2026-05-18
Deploy: https://app.swingandsavor.at (prod)

## Strategischer Kontext

Strava wächst nicht über die App, sondern über Instagram-Stories: User schießen ihr Outdoor-Foto, legen Strava's transparente Stats-Overlay drauf, posten in ihre Story, und die Strava-Marke reist gratis mit. Diese Phase baut das exakte Pendant für Golf.

## Was geliefert wurde

### 1. `src/lib/cardRenderer.js` (Canvas 2D, null externe Deps)

Drei Templates, alle Champagne-auf-Off-Black, Fraunces-Headlines, Inter-Labels:

| Template | Größe | Hintergrund | Anwendung |
|---|---|---|---|
| `renderStoryOverlay` | 1080 × 1920 | **TRANSPARENT** | IG-Story-Overlay über User-Golf-Foto (Strava-Killer) |
| `renderChampionCard` | 1080 × 1080 | Solid Dark Luxury | Feed-Post / WhatsApp-Square |
| `renderPortraitCard` | 1080 × 1350 | Solid Dark Luxury | WhatsApp Vertical / Pinterest |

**Story-Overlay-Design (das Kernartefakt):**
- Top 60 % bleiben frei → der User legt sein Golf-Foto darunter.
- Oben zentriert: Eyebrow „Champion" oder „Round of", Fraunces-Cup-Name + Course/Datum-Subline.
- Unten 40 % → Stats-Panel mit transparentem-zu-Off-Black-Gradient (lesbar auf jedem Foto-Hintergrund).
- Stats-Layout: Player-Name + Hero-Score (links, 168px) + 3 Side-Stats (rechts: Birdies, Longest Drive, Closest to Pin).
- Footer: S·S-Monogramm-Lockup links, „SWING & SAVOR"-Wordmark rechts, kleiner Champagne-Dot.

**Champion-/Portrait-Card-Design:**
- Off-Black mit Champagne-Radial-Glow von oben.
- Optionaler Avatar als 200px-Kreis mit Champagne-Border.
- Award-Eyebrow (z.B. „Founder Invitational Winner") + Hairline-Trennstrich.
- Riesiger Score (Champagne, Fraunces 180–220px).
- Optional Sponsor-Slot („POWERED BY [Name]") über S·S-Footer.

**Sharing:**
- Web-Share-API mit File-Attachment (iOS Safari + Chrome) für native Share-Sheet.
- Fallback: Download als PNG.
- Capacitor-fähig (läuft im iOS/Android-Wrapper über Web-Share-API).

### 2. `src/components/WinnerCardSheet.jsx`

Bottom-Sheet-Modal mit Editorial-Tab-Switch zwischen den drei Formaten:
- Tabs: `Story · Champion · WhatsApp`
- Story-Tab: transparenter Schachbrett-Hintergrund hinter dem Preview (zeigt Transparenz visuell).
- Square-/WhatsApp-Tab: Dark-Luxury-Hintergrund.
- Hinweis-Text auf Story-Tab: „Speichere die Grafik und lege sie über dein Golf-Foto in der IG-Story."
- Single CTA: „Share Story / Champion" mit Champagne-Solid-Button.
- Auto-Render aller drei Formate beim Öffnen (parallel via Promise.all).

### 3. Integration in InvitationalScreen (`/i/:slug`)

- Finished Cup → primärer CTA wird „Share as Story Overlay" (statt „I'm in").
- Champion-Payload wird aus `score_a / score_b` abgeleitet.
- ShareUrl = aktuelle Invitational-URL.

### 4. Integration in MatchDetailScreen

- Neuer Editorial-Button „Story Overlay · Strava-Style" direkt unter der Social-Bar, **nur sichtbar wenn Match `done = true`**.
- Champagne-Icon (Bild-Frame mit Sun) + Fraunces-Wordmark.
- Payload nutzt Flight-Names oder Team-Names als Champion-Label.
- ShareUrl deeplinkt auf das Match.

### 5. i18n-Ergänzungen (de + en)
- `winnerCard.champion`, `winnerCard.founderInvitational`, `winnerCard.rivalryWinner`, `winnerCard.longestDrive`, `winnerCard.closestToPin`, `winnerCard.mvp`, `winnerCard.poweredBy`
- `share.storyOverlayCta`, `share.storyOverlayHint`
- `share.instagram` als zusätzliches Share-Target

## Wie der virale Loop funktioniert

1. Spieler beendet Match oder Cup.
2. App zeigt „Story Overlay"-CTA prominent.
3. Spieler tippt → transparente PNG wird in <1 s gerendert.
4. Web-Share-API öffnet System-Share-Sheet → IG, WhatsApp, Save.
5. Spieler wählt „Instagram Stories" oder speichert das PNG.
6. In IG: User wählt ein eigenes Golf-Foto, legt PNG-Overlay drauf, postet.
7. Followers sehen Foto + Stats + S·S-Branding → Klick auf S·S-Sticker führt zur App.
8. Wiederholt sich bei jedem Cup-Ende → exponentieller Reach.

## Akzeptanz (laut V2 §18 + Anweisung MVP §6)

| Kriterium | Status |
|---|---|
| Winner Card ist in WhatsApp + IG teilbar | ✓ 3 Formate (Story 9:16, Square 1:1, WhatsApp 4:5) |
| Automatisch erzeugt | ✓ Canvas-Rendering ohne manuelles Design |
| Emotional formuliert | ✓ „Champion", „Founder Invitational Winner", nicht „Platz 1" |
| Wiedererkennbar | ✓ S·S-Monogramm + Dark-Luxury-Tokens in jedem Template |
| Sponsor-fähig | ✓ „POWERED BY [Sponsor]"-Slot dezent über Footer |
| Status (Gewinner-Hierarchie) | ✓ Champagne-Score + Award-Eyebrow |
| Format-Vorbereitung | ✓ Story 1080×1920, Square 1080×1080, WhatsApp 1080×1350 |
| Build grün + Deploy | ✓ |

## Was bewusst NICHT gebaut wurde

- Server-seitiges PNG-Rendering (Satori / `@vercel/og`) — Canvas-2D im Browser ist schnell genug für MVP, kein Cold-Start-Risiko.
- Eigener IG-Story-Sticker (würde IG-Business-API + Verifikation erfordern). Web-Share-API + manuelles Overlay reicht für Phase 2.
- Photo-Upload-Komponente für Spieler-Avatar (kommt indirekt über existierendes ProfileScreen, das schon Avatar-Upload hat).

## Nächste Phase

Phase 3: Recap als digitales Magazin (`/recap/:slug`, OG-Meta für Social-Crawler, „Sicher dir deinen Platz für die nächste Edition"-CTA).
