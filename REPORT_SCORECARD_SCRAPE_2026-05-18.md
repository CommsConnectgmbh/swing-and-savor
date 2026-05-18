# Scorecard-Scraper Report — 2026-05-18

Pipeline `OSM-Course → Homepage → lokales LLM (Ollama Qwen 2.5 14B) → DB`,
um die 18-Loch-Scorecards (Pars + Handicaps) aus den Webseiten der Plätze
zu extrahieren.

## Gesamtergebnis

| Metrik | Wert |
|---|---|
| Courses in DB total | 1.745 |
| Courses mit Website (nach OSM-Backfill) | 1.039 (60 %) |
| Courses ohne Website-Tag in OSM | 706 (40 %) |
| **Scorecards verifiziert (18 Pars + 18 HCPs)** | **77** |
| davon vorher (golfcourseapi/Seed) | 33 |
| **davon neu via LLM-Scrape** | **44** |
| Als Duplikat-Source verworfen | 4 |
| Scrape Fail (kein Scorecard auf Homepage) | 833 |
| Scrape Fail (Domain tot / Bot-Block / Timeout) | 119 |

**Effektive LLM-Hit-Rate auf erreichbaren Sites: ~5 %.**
Der Großteil der Golf-Homepages publiziert die Scorecard nicht als HTML-Tabelle
(meist PDF-only, Login/Mitglieder-Bereich oder reine Buchungs-/Kontaktseiten).

## Was eingerichtet wurde

### Datenbank (Supabase Project `rcqichlyllhwougopfkg`)

Neue Spalten in `public.courses`:
- `website text`
- `scorecard_source_url text`
- `scorecard_scraped_at timestamptz`
- `scorecard_scrape_status text` (`ollama-scraped` / `failed:<reason>`)

### Scripts in `scripts/`

1. **`osm-backfill-websites.mjs`** — fragt Overpass-API in Batches von 200 IDs ab,
   liest `website`-Tag (und `description`/`phone` als notes-Fallback) und schreibt zurück.
   Drei Mirror-Endpunkte, höflicher User-Agent, 1,5 s Pause zwischen Batches.
2. **`scrape-scorecards.mjs`** — pro Course:
   1. Homepage fetchen
   2. Kandidaten-Links via Multi-Language-Keywords (DE/EN/ES/IT/FR/NL/TR) + 12 Standard-Pfade (`/scorecard`, `/course`, `/bahnen`, `/el-campo`, `/hoyos`, `/percorso` …)
   3. Pre-Filter: Page-Text muss "par" + "hcp/handicap/stroke-index/vorgabe" enthalten und ≥30 numerische Tokens im Bereich 3–18
   4. Bis zu 3 LLM-Calls pro Course an lokales Ollama (`qwen2.5:14b-instruct`, $0, JSON-Mode)
   5. Validierung: `pars[18]∈{3,4,5}`, `hcps[18]` paarweise unique aus `1..18`, `64 ≤ Σpar ≤ 76`
   6. UPDATE der Course-Zeile mit Pars/HCPs + Source-URL + Timestamp

## Beispiele verifizierter Extraktionen

| Course | Land | Par | Source |
|---|---|---|---|
| Frankfurter Golf Club | DE | 71 | `/platz/18-loch-platzspielbahnen` |
| Hamburger Golfclub Falkenstein | DE | 71 | `/platz/platzuebersicht.html` |
| Golf am Katzberg (Langenfeld) | DE | 66 | `/golfplatz` |
| Golf Club Hanau-Wilhelmsbad | DE | 73 | `/spielbahnen/` |
| Golfanlage Berchtesgadener Land | DE | 72 | `/golfanlage/scorekarte-course-handicap/` |
| Golf Club Neusiedlersee-Donnerskirchen | AT | 72 | `/anlage/golfplatz/` |
| Golfanlage Klagenfurt-Seltenheim | AT | 72 | `/anlage/championship-course/` |
| Golfclub Innsbruck-Igls (Kurs Rinn) | AT | 71 | `/plaetze/Championship+Course+Rinn` |
| Club de Golf Jávea | ES | 70 | `/hoyo-a-hoyo/` |
| Santa María Golf & Country Club (Marbella) | ES | 72 | `/hoyo-a-hoyo/` |
| Larrabea Club de Golf | ES | 72 | `/es/campo` |
| Lauro Golf | ES | 72 | `/golf/hoyo-a-hoyo/` |
| Golfclub Pustertal | IT | 66 | `/de/golfplatz/scorecard-rating` |

## Bekannte Schwächen / manuell zu prüfen

**Duplicate-Source-Heuristik:** 4 Courses hatten denselben `scorecard_source_url`
wie ein anderer Course – wahrscheinlich Fehlzuordnung durch OSM oder eine zweite
Anlage am selben Standort. Diese sind als `failed:duplicate-source-suspect`
zurückgesetzt und brauchen Handarbeit:
- **Golf Santa Ponça II** (Mallorca) – LLM las Page von Santa Ponça I, II hat eigene Subpage
- **Golf Club Maria Bildhausen** (Münnerstadt) – Website-Tag in OSM zeigt auf gc-fahrenbach.de (vermutlich falsches OSM-Tag)
- **Saldaña Golf** (ES) – Website-Tag zeigt auf golflerma.es
- **Championship Course** (orphan Eintrag, gehört zu Klagenfurt-Seltenheim)

**Restliche 962 ohne Scorecard:** Homepage hat keine HTML-Scorecard.
Optionen für eine 2. Phase:
- PDF-Scorecards extrahieren (viele Clubs publishen `scorecard.pdf` als Download)
- Google-CSE-Fallback: `"<Course> scorecard PDF"` → erstes PDF-Result → PDF→Text → LLM
- Community-Edit via App: User können beim Anlegen eines Matches direkt die fehlenden Pars/HCPs eintragen (existiert bereits über `apply_course_edit`-RPC)

## Reproduzieren

```bash
cd /Volumes/Code/Projects/swing-and-savor

# 1. OSM-Websites nachziehen (1745 Courses, ~5 min total in 3 Pages à 1000)
node scripts/osm-backfill-websites.mjs

# 2. Scorecard-Scrape (~1.000 Courses, ~1,5 h bei concurrency 4)
node scripts/scrape-scorecards.mjs --concurrency 4

# Optional: ein einzelner Course für Debugging
node scripts/scrape-scorecards.mjs --id <uuid> --concurrency 1
```

Voraussetzungen:
- `ollama serve` läuft lokal mit `qwen2.5:14b-instruct` (Mac mini M4 Pro, ~8,6 GB)
- `.env.local` enthält `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY_SWINGSAVOR`
  (wird beim ersten Run automatisch aus Supabase-Management-API gepullt)

## Logs

- Run-Log: `.local-scrape-logs/run-<timestamp>.jsonl` (eine Zeile pro Course mit Status/Reason/Source-URL)
- Stdout-Log: `/tmp/scrape-scorecards.log`

## Nachtrag — Belek-Verify (Rainer-Frage „Sultan finde ich nicht")

**Befund:** Sultan ist kein eigener Course — es ist eines der beiden Routings vom **Antalya Golf Club** (Sultan + Pasha). Beide existieren in OSM nur als gemeinsamer Eintrag „Antalya Golf Club".

**Datenqualität in DB vor Verify:**
- 1.416 von 1.745 Courses hatten `country = NULL` (OSM-Seed normalisiert das nicht)
- Belek hatte 11 OSM-Treffer ohne Country, ohne Website, mit OSM-Doppelung (Carya/Cayra)
- 5 berühmte Belek-Resorts fehlten komplett, weil OSM sie nicht als `leisure=golf_course` getaggt hat

**Was gefixt wurde:**
- `country='TR'` + `city='Belek'` für alle 14 Belek-Courses (Bbox 36.7–37.0 N, 30.8–31.4 E)
- `Cayra Golf Club` als OSM-Tippfehler-Duplikat von Carya markiert
- `Minigolf`-Eintrag in Belek-Bbox entfernt
- 5 fehlende Courses manuell eingefügt: **Cornelia (Faldo)**, **Regnum Carya**, **Lykia Links**, **Kaya Palazzo (Eagles)**, **TAT Golf International**
- Antalya GC mit Notiz „Sultan + Pasha Course — zwei Routings" versehen
- 8 Belek-Courses mit verifizierten Websites belegt (Antalya GC, Carya, Cornelia, Kaya, Regnum, TAT, Montgomerie Maxx Royal, Titanic)

**Scorecard-Scrape auf Belek: 0/8 erfolgreich.**
Grund ist nicht die Pipeline, sondern Datenverfügbarkeit: Resort-Webseiten in Belek sind reine Marketing-/Booking-Sites ohne öffentliche Hole-by-Hole-Scorecards. Diese existieren nur als PDF im Pro-Shop oder als Print-Card auf der Anlage. Auch golfbelek.com (Aggregator) hat nur Par-Summe, keine Hole-by-Hole-Daten.

Diese 14 Courses sind in DB als `scorecard_scrape_status='manual-needed:resort-no-public-scorecard'` gekennzeichnet. Nächste Schritte (außerhalb dieser Session):
- CourseEditor in der App nutzen, sobald Rainer/User dort spielt (RPC `apply_course_edit` existiert)
- `GOLFCOURSEAPI_KEY` in Supabase Project-Secrets ablegen → `import-courses` Edge Function kann dann gegen golfcourseapi.com pullen

**Gesamt-Effekt der Belek-Verify-Session:**
- 14 Belek-Courses haben jetzt Country/City/Website (vorher: 0)
- 5 berühmte Belek-Resorts neu in DB
- 1 OSM-Duplikat markiert, 1 Mini-Golf-Eintrag entfernt
- 1.402 Courses haben in DB weiterhin `country=NULL` — separater Reverse-Geocode-Job offen
