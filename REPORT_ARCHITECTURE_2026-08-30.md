# Architektur-Review & Refactoring-Fahrplan — swing-and-savor

**Datum:** 2026-08-30 · **Scope:** Frontend (`src/`) · **Ziel:** Code-Qualität,
Skalierbarkeit und Wartbarkeit heben — **ohne** Funktionsänderung.

Dieser Report ist die Bestandsaufnahme für eine Serie kleiner, verhaltens-
erhaltender Refactoring-PRs (ein PR pro Tag). Er beschreibt die Ist-Architektur,
benennt die kritischen Problemzonen und legt eine priorisierte Roadmap fest. Der
erste Schritt der Roadmap (§5, Schritt 1) ist in **diesem** PR bereits umgesetzt.

---

## 1. Architektur-Überblick

Reine Client-SPA, Backend vollständig über Supabase (Postgres + Auth + Storage +
Edge Functions). Kein eigener App-Server; `api/og.js` ist eine einzelne
Vercel-Serverless-Funktion für OG-Images.

```
main.jsx → <AuthProvider> → <App/>
                              │
   ┌──────────────────────────┼───────────────────────────────┐
   │  Routing (react-router)   │  Global State                 │
   │  App.jsx: lazy-Screens    │  lib/auth.jsx (einziger       │
   │  + SavorGate + PublicCup  │  React-Context)               │
   └──────────────────────────┴───────────────────────────────┘
                              │
        Screens (src/screens/*)  ── rendern ──►  Components (src/components/*)
                              │
        Datenzugriff (src/lib/*)  ──►  Supabase-Client (lib/supabase.js)
                              │
        Realtime-Toasts: lib/liveEvents.js + lib/realtime.js (pub/sub)
        Out-of-React-Bus: lib/toast.js
```

**Datenfluss (Standardfall):** Ein Screen mountet → `useEffect(() => load(), [])`
→ ruft entweder eine `lib/*`-Facade-Funktion **oder** direkt `supabase.from(...)`
→ setzt lokalen `useState`. Es gibt keine geteilte Cache-/Query-Schicht; jeder
Screen lädt seine Daten selbst neu.

**Positiv hervorzuheben — die `lib/`-Schicht ist teilweise bereits sauber
konsolidiert:**

- `lib/profiles.js` — Profil-Datenzugriff (`PROFILE_CARD_COLUMNS`, `indexById`,
  `fetchProfileList/Map`, `searchProfiles`).
- `lib/friendships.js` — symmetrische Freundschaften an einer Stelle.
- `lib/functions.js` — Edge-Function-URLs + Auth-Header (verhindert das
  byte-genaue Kopieren des `/functions/v1/`-Pfades).
- `lib/format.js`, `lib/names.js`, `lib/debounce.js` — geteilte Formatter/Helper.
- `lib/realtime.js::subscribeToTables` — guter gemeinsamer Wrapper für das
  `channel().on('postgres_changes').subscribe()`-Idiom (6 Nutzer).
- `lib/auth.jsx` — sorgfältig gebaut (In-Flight-Dedup per Refs, NOT_FOUND-
  Sentinel, Retry, Auth-Lock-Deferral).

Die tief hängenden Früchte sind also bereits geerntet. Die verbleibende
Duplizierung ist konzentriert und benennbar (§2/§3).

---

## 2. Kritische Problemzonen

### 2.1 Duplizierte Storage-Upload-Sequenz *(in diesem PR behoben)*
Die Sequenz „EXIF/GPS strippen → `storage.upload` → bei Fehler werfen →
`getPublicUrl`" war **9×** über **6 Dateien** kopiert (`lib/avatar.js`,
`lib/photo.js` ×2, `AdminScreen`, `HomeScreen`, `CupExtrasSheet` ×3,
`ScorecardSheet`). Die Kopien waren bereits auseinandergedriftet — u. a. schrieb
`lib/photo.js::uploadCupCover` Cup-Cover in den Bucket `match-photos`, während
`HomeScreen`/`CupExtrasSheet` dieselben Cover in `cup-covers` legen.
→ Zentralisiert in `lib/storage.js` (`BUCKETS`, `uploadToBucket`,
`uploadPublic`). Verhalten pro Aufrufstelle exakt erhalten (inkl. der
`match-photos`-Eigenheit — bewusst nicht „korrigiert", da das eine
Funktionsänderung wäre).

### 2.2 Inline-Profilabfragen an `lib/profiles.js` vorbei
Trotz der Facade lösen mehrere Screens noch eigene
`from('profiles').select('id,handle,display_name,avatar_url').in('id', …)`-
Abfragen aus (u. a. `ProfileScreen`, `MessagesScreen`, `ConversationScreen`,
`LeaderboardScreen`, `ChallengesScreen`, `OnboardingScreen`, `auth.jsx`,
`liveEvents.js`). Die Spaltenliste ist ≥4× wörtlich dupliziert (ein naher Klon
von `PROFILE_CARD_COLUMNS`).

### 2.3 Zwei parallele Fehler-/Notification-Wege
`alert()`/`confirm()` (≈115 Stellen, 27 Dateien) **neben** dem dedizierten
`pushToast`-Bus (nur 4 Dateien, 11 Aufrufe). `@sentry/react` ist initialisiert
(`src/sentry.js`), wird aber **nirgends** aufgerufen — es gibt kein einziges
`captureException` im App-Code; sämtliches Fehler-Signal ist `console.*`.

### 2.4 Uneinheitliche Fehler-Konvention in der Datenschicht
Drei Muster koexistieren: *swallow-and-default* (`const { data } = …; return data
?? []`), *log-and-default* (`courses.js`) und *throw* (`avatar.js`, `photo.js`).
Viele Lese-Pfade verschlucken Fehler komplett — ein Ausfall erscheint als leere
Liste ohne Log.

### 2.5 Magic Strings ohne zentrale Definition
- **Tabellennamen:** ≈160 String-Literale (`'matches'`, `'tournaments'`,
  `'profiles'`, …) ohne Konstanten.
- **Status-Enums** als nackte Strings: `'accepted'`, Match-`status`
  `'active'`/`'finished'`, `winner` `'A'`/`'B'`/`'halved'`, Savor
  `active/sold_out/draft/archived`, OCR `'pending'`.
- **Bucket-Namen** — mit diesem PR zentralisiert (`BUCKETS`).

### 2.6 Monolithische Screens
`CasualScreen` (1339 Z.), `MatchesScreen` (1074), `MatchDetailScreen` (1044),
`AdminScreen` (965), `HomeScreen` (794), `ProfileScreen` (750), `CupScreen`
(747) halten jeweils viele `useState` + Fetch-Effekte in einer Komponente.
Nicht Ziel eines *sicheren* Refactorings, aber der größte Wartbarkeits-Hebel
mittelfristig.

### 2.7 Performance / Skalierung
- **N+1 bei Realtime-Toasts:** `liveEvents.js::profileFor` lädt ein Profil pro
  Event (gecached, aber ein Roundtrip je neuem Absender).
- **Sequentielle unabhängige Queries:** `stats.js::fetchPlayerStats` fährt
  invites→owned→matches→hole_results seriell; die ersten beiden sind unabhängig
  (`Promise.all`-Kandidat).
- **Keine Pagination-Schicht:** viele Screen-Queries ohne `.limit()`
  (`MatchesScreen`, `HomeScreen`-Feed). Skaliert nicht mit wachsenden Daten.

---

## 3. Saubere Ziel-Architektur (Richtung)

Kein Big-Bang-Rewrite. Die bestehende „`lib/`-Facade + dünne Screens"-Idee ist
richtig — sie muss nur konsequent durchgezogen werden:

1. **Jede** Supabase-Interaktion läuft über eine `lib/*`-Domänenfunktion; Screens
   enthalten keine rohen `supabase.from(...)`-Ketten mehr.
2. **Ein** einheitlicher Fehler-/Notification-Weg (`pushToast` + optional Sentry
   für unerwartete Fehler); `alert()` nur noch für echte Blocking-Confirms.
3. Magic Strings (Tabellen, Buckets, Status-Enums) in benannten Konstanten.
4. Große Screens schrittweise in Sub-Komponenten + Custom-Hooks (`useCupData`,
   `useMatchDetail`, …) zerlegen.

---

## 4. Umgesetzt in diesem PR (Schritt 1)

**Zentrale Storage-Upload-Facade `src/lib/storage.js`.**
- `BUCKETS` — die sechs Bucket-Namen an einer Stelle.
- `uploadToBucket(bucket, path, file, options)` — Metadaten-Strip + Upload +
  Throw. Für private Buckets (`scorecard-photos`).
- `uploadPublic(bucket, path, file, options)` — zusätzlich `getPublicUrl`.
- Alle 9 Aufrufstellen umgestellt (−63/+25 Zeilen im Aufruf-Code).
- Unit-Tests `src/lib/storage.test.js` (7 Tests): Strip-Reihenfolge, Options-
  Durchreichung, Throw-Semantik, URL-Auflösung, „private, kein getPublicUrl".
- Verhalten pro Aufrufstelle exakt erhalten: identische Options-Objekte,
  identische Pfade, identische DB-Writes, identische Throw-Semantik, identische
  `console.error`-Logs (avatar). Lint 0 Errors · 103 Tests grün · Build grün.

---

## 5. Refactoring-Roadmap (nachfolgende Tages-PRs)

Priorisiert nach (Impact × Sicherheit × kleiner Diff):

| # | Schritt | Risiko | Status |
|---|---|---|---|
| 1 | Storage-Upload-Facade + `BUCKETS` | niedrig | **erledigt (dieser PR)** |
| 2 | Inline-`from('profiles')` → `fetchProfileMap/List` (§2.2) | niedrig-mittel¹ | offen |
| 3 | Tabellennamen + Status-Enums als Konstanten (§2.5) | niedrig, großer Diff | offen |
| 4 | `stats.js` unabhängige Queries parallelisieren (§2.7) | niedrig | offen |
| 5 | Sentry `captureException` an den `throw`-Pfaden verdrahten (§2.3) | niedrig² | offen |
| 6 | `alert()` → `pushToast` vereinheitlichen (§2.3) | **mittel³** | offen |
| 7 | Monolithische Screens in Hooks/Sub-Komponenten (§2.6) | mittel-hoch | offen |

¹ Spaltensets unterscheiden sich minimal (`hcp`, `elo_rating`) — pro Aufrufstelle
prüfen, nicht blind ersetzen.
² Rein additiv (Observability), keine UI-Änderung.
³ Ändert sichtbares Verhalten (Alert-Dialog → Toast) — **keine** reine
Verhaltenserhaltung, daher bewusst später und separat abstimmen.
