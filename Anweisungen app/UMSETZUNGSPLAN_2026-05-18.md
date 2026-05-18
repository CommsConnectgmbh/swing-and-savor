# Swing & Savor: Umsetzungsplan „Million Gold Brand"

Stand: 2026-05-18. Master-Plan zur Umsetzung der 4 Anweisungsdokumente (V2 + MVP-Briefing + Roadmap-Addendum + Ambassador-Briefing). Quelle für alle Phasen-Reports.

## 1. Leitsatz

> **Swing & Savor ist Strava × Soho House × Eventbrite – aber für Golf-Mikro-Communities.**
> Spieler zahlen nicht. Captains werten Events auf. Clubs kaufen Wiederholung. Sponsoren kaufen Engagement.

Die Plattform muss sich nach **Einladung, Status, Inszenierung und Erinnerung** anfühlen – nie nach Verwaltung, Score-Tracking oder Vereinssoftware.

## 2. Virale Mechanik (Strava-Parallele)

Strava wächst nicht über die App, sondern über **Instagram Stories**. Spieler posten eigene Outdoor-Fotos, Strava liefert dazu eine **transparente Stats-Overlay-Grafik** (Distance, Pace, Time, Logo). Die Marke reist gratis mit.

Für Swing & Savor heißt das: Wir bauen denselben Hebel, nur für Golf.

| Strava-Element | Swing-&-Savor-Pendant |
|---|---|
| Aktivität (Run/Ride) | Cup / Invitational / 9-Holes-Runde |
| Stats (Distance/Pace/Time) | Score, Birdies, Eagles, Longest Drive, Closest to Pin, Final Rank |
| Karten-Overlay | Course-Outline + Hole-Map oder Birdie-Marker |
| Story-Overlay PNG | „Powered by S&S"-Lockup transparent über Spielerfoto |
| Winner Card | Editorial Champion-Card |
| Activity-Feed | Event-Feed + Crew-Hall-of-Fame |

Die Story-Overlay-Engine wird **gleichwertig zu Winner Cards** priorisiert.

## 3. Sieben Phasen

| Phase | Fokus | Deliverable | Status |
|---|---|---|---|
| 0 | Brand & Language Reset | Dark-Luxury-Tokens, Hairline-Wordmark, i18n-Switch | startet jetzt |
| 1 | Invitational-Page Hero | /i/:slug Editorial-Einladung, <60s-Beitritt | offen |
| 2 | Winner Cards + Story Overlays | Auto-PNG-Generator, 3 Formate, transparente IG-Story-Overlay | offen |
| 3 | Recap-Magazin | /recap/:slug Editorial, OG-Meta, Wiederkehr-CTA | offen |
| 4 | Hall of Fame light | /hall/:slug Crew-Historie, Trophy-Wall | offen |
| 5 | Premium + Sponsor | Stripe 49€, Powered-by-Slot | offen |
| 6 | Admin + Ambassador-CRM | Rainer-only, 5 Rollen, Deckungsbeitrag-Logik | offen |
| 7 | Founder-Invitational-Launch | Live-Event als Sales-Asset | nach Phase 6 |

Jede Phase: build → deploy → REPORT_PHASE_X_2026-05-18.md im Projekt-Root.

## 4. Visuelle Marken-Doktrin (Dark Luxury, nicht „Dark Mode")

| Token | Wert | Verwendung |
|---|---|---|
| `--ink` | `#0A0A0A` | Hintergründe, harte Flächen |
| `--ink-soft` | `#141414` | Surface, Cards |
| `--bone` | `#F4F1EA` | Text, Headlines |
| `--champagne` | `#D9C9A8` | Akzent, Active-State, CTA-Highlights |
| `--champagne-deep` | `#A8956A` | Hover, Gold-Glanz |
| `--hairline` | `rgba(244,241,234,0.08)` | Borders, Dividers |
| Serif | Editorial-Display (Headlines) | Hero, Recap, Winner-Card |
| Grotesk | UI-Body | Navigation, Forms, Listen |

Regeln (aus Memory):
- Active-States in Champagne, nie flach schwarz/weiß.
- Keine doppelten Active-Indicators (Color ODER Punkt).
- Keine Glass/Blur auf Sticky-Headern.
- Reduced-Motion respektieren.

## 5. Sprach-Switch (i18n)

| Alt | Neu |
|---|---|
| Tournament / Event | Invitational / Cup |
| Host / Organizer | Captain |
| Group / Team | Crew / Circle |
| Participants | Players |
| Ranking | Leaderboard |
| Archive / History | Hall of Fame / Legacy |
| Download App | Du wurdest eingeladen |
| Premium kaufen | Event auf Premium upgraden |

Implementiert in `src/locales/de.json` + `en.json`, ohne neue Komponenten zu duplizieren.

## 6. Story-Overlay-Engine (Strava-Killer)

Server-seitige PNG-Generierung via `@vercel/og` oder Edge-Function mit Satori.

| Format | Auflösung | Use Case |
|---|---|---|
| Story | 1080 × 1920, transparenter Hintergrund | User legt es in IG-Story über eigenes Foto |
| Square | 1080 × 1080 | Feed-Post |
| WhatsApp | 1080 × 1350 | Chat-Share |

Inhalte (parametrisierbar pro Spieler/Event):
- Final-Score, Schläge unter/über Par, Birdies, Eagles
- Course-Name, Datum, Cup-Name
- „Powered by S&S" Lockup unten
- Optional: Champion-Lockup für Sieger

Trigger:
- Auto nach Event-Ende (alle Player)
- Manuell jederzeit pro Spieler im Profile

Distribution:
- Native Web Share API + Capacitor `@capacitor/share`
- Direct-Link zu IG/WhatsApp wo möglich

## 7. Pricing (MVP)

| Paket | Preis | Sichtbar für |
|---|---|---|
| Free Invitational | 0 € | Captain |
| Premium Invitational | 49 € einmalig | Captain |
| Spieler-Zugang | 0 € | Spieler |

**Spieler sehen niemals einen Preis** – das ist verbindliche MVP-Regel.

## 8. Nicht-zu-bauen-Liste

GPS-Tracking, Course-Maps live, AI Coach, Swing-Analyse, offizielle Handicap-Engine, voller Marketplace, eigener Chat, Spieler-Premium, viele Spielformate, automatisches Affiliate-Tracking, öffentliches Partner-Portal, Multi-Level-Partner.

## 9. Ambassador-CRM (Phase 6)

Strict laut Briefing §8/§9: 5 Rollen (`connector` 15 %, `host_partner` 30 %, `operating_partner` 50 %, `renewal_passive` 15 %, `renewal_active` 30 %), Berechnung auf operativem Deckungsbeitrag, manuelle Approval-Pipeline `draft → pending_review → approved → paid`, 12-Monats-Verfall, CSV-Export.

## 10. Akzeptanz-Marker pro Phase

Jede Phase gilt erst dann als „done", wenn:
1. `npm run build` grün.
2. Deploy auf swingandsavor.at (Produktion) durch.
3. Visueller Smoke-Test auf iPhone-Viewport.
4. REPORT_PHASE_X im Projekt abgelegt.
5. Keine Memory-Regel verletzt (keine doppelten Active-States, keine Demo-Daten in Prod, Hochdeutsch in UI etc.).

---

Letzte Regel: **Wenn ein Feature nicht Community, Status, Eventisierung oder Shareability stärkt, gehört es nicht in den MVP.**
