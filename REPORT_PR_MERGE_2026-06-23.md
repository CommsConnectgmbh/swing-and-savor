# Swing & Savor — Olivers PRs gemergt + deployed (2026-06-23)

## Ergebnis
**Alle 12 offenen PRs gemergt, CI grün, PWA live deployed.** TestFlight-Eintrag für Oliver vorbereitet, aber durch einen abgelaufenen Apple-Vertrag blockiert (Aktion durch Rainer nötig, s.u.).

## Gemergte PRs (alt → neu, squash, Branch gelöscht)
| PR | Titel | Anmerkung |
|----|-------|-----------|
| #21 | refactor(format): display formatters → lib/format | clean |
| #23 | refactor(savor): offer-price formatter → lib/savor | clean |
| #24 | refactor(functions): Edge-Function-URLs → lib/functions | clean |
| #25 | refactor(data): profiles + friendships data-access | **Konflikt gelöst** (Imports) |
| #26 | refactor(names): avatar-initials → lib/names | **Konflikt gelöst** (Imports + tote FUNCTIONS_URL-Consts entfernt) |
| #27 | refactor(lib): format & canvas helpers | **Stark überlappend** — nur echter Mehrwert behalten (lib/canvas, fmtEur, fileExt + 4 Komponenten); Duplikate von #23/#26 (initials, priceLabel) verworfen |
| #28 | refactor(profiles): fetchProfilesById + Architektur-Doc | **Duplikat von #25** — Code verworfen, nur Architecture-Doc + Profiles-Tests behalten (Tests + Doc an reale API `fetchProfileMap` angepasst) |
| #29 | refactor(realtime): Channel-Subscription zentralisiert | clean |
| #30 | fix(ios): Safari-Auto-Zoom auf Formularfeldern verhindern | clean |
| #31 | chore(deps): form-data 4.0.5 → 4.0.6 (dependabot) | clean |
| #32 | chore(lint): ESLint-Flat-Config + CI | **Konflikt gelöst** (package-lock via npm install) **+ Bugfix:** Ignores um `pwa_build/**` und `deploy_upload/**` ergänzt (linteten minifizierten Build-Output → 1852 Fake-Errors) |
| #33 | feat: QuickLaunch AR Launch Monitor (Pro-Feature) | gemergt, aber **Backend zurückgehalten** (s.u.) |

### Hintergrund der Konflikte
Olivers „peaceful-dirac"-Serie sind tägliche, parallel von altem `main` abgezweigte Refactor-PRs. Da keiner gemergt war, haben spätere PRs dieselben Helfer nochmal (anders) extrahiert. Beim Mergen alt→neu mussten die Überlappungen reconciled werden: behalten wurde jeweils die zuerst gemergte, granulare Modulstruktur (`lib/names`, `lib/savor`, `lib/functions`, `lib/profiles`), Duplikate wurden verworfen.

### Verifikation finaler `main`
- `npm run lint` → **0 Errors** (69 Warnings, blockieren CI nicht)
- `npm test` → **73 Tests grün**
- `npm run build` → grün
- CI `verify` auf main HEAD → **success**
- Prod: `app.swingandsavor.at` + `swingandsavor.at` → HTTP 200 (PWA via Vercel auto-deploy live)

## #33 QuickLaunch AR — Backend bewusst zurückgehalten
Laut eigenem Commit/Doku ist das Feature WIP:
- iOS-Native-Code (Capacitor-Plugin + QuickLaunchKit Swift Package) **nicht kompiliert** (auf Windows geschrieben).
- **Kein Payment-Reconciler** → selbst nach Zahlung würde `is_pro` nie auf `active` flippen.
- **App-Store-IAP-Policy offen** — digitales Feature per Stripe in iOS-App riskiert Ablehnung.
- `/range`-Route ist in **keiner Navigation** verlinkt → Dark-Launch, schadet nichts.

**Sicherheitsbefund:** Migration `033_pro_entitlements.sql` legt `is_pro`/`pro_until` auf `profiles` an. Die aktuelle RLS-Policy `profiles_update_self` erlaubt UPDATE der eigenen Zeile **ohne Spalten-Einschränkung** → jeder User könnte sich selbst `is_pro = true` setzen (Gratis-Pro). Deshalb:
- Migration 033 **nicht** angewandt.
- `create-pro-checkout` Edge Function **nicht** deployed.
- Vor einem späteren Go-Live: erst RLS härten (Spalten-Lock `is_pro`/`pro_until` auf `service_role`), dann Reconciler bauen + IAP-Frage klären.

## TestFlight für Oliver — fast fertig (1 Schritt offen, hängt an Oliver)
- Tester-Mail: **oli.hoffmann@outlook.com** (= GitHub `olihoffmann`, Repo-Collaborator).
- **Apple-Vertrag:** Der ursprüngliche 403-Blocker (`REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`) ist gelöst — Rainer hat die aktualisierte **Apple Developer Program License Agreement** am 23.06.2026 akzeptiert (developer.apple.com/account). ASC-API schreibt wieder.
- **Externes Testing nicht möglich:** Apple gibt `422 CLOSED_VERSION` — Version 1.1.4 und früher sind für Beta-Review geschlossen; externe Tester bräuchten einen frisch hochgeladenen neuen Build. → Auf **internes Testing** umgestellt (Rainers Entscheidung).
- **Erledigt per ASC-API:**
  - Oliver als **Team-User eingeladen** (Rolle Developer, nur Swing&Savor sichtbar) → Einladungsmail raus (Invitation `cad8a8a7…`).
  - Build **17 (1.1.4)** an die interne Gruppe **„Internal Testing"** gehängt.
  - Redundanten externen Tester-Eintrag + leere External-Gruppe wieder entfernt (sonst Dead-Invite).
- **Offen (hängt an Oliver):** Oliver muss die **Team-Einladungsmail annehmen**. Danach ein Befehl:
  `node scripts/asc-finish-internal.mjs`
  → fügt ihn in „Internal Testing" ein, Build 1.1.4 ist sofort in TestFlight installierbar. Skript ist idempotent (vorher: „noch nicht angenommen").

### Skripte (im Repo, wiederverwendbar)
- `scripts/asc-add-tester.mjs` — externen Tester anlegen (für später, wenn ein externer Build existiert).
- `scripts/asc-finish-internal.mjs` — Oliver nach Annahme in Internal Testing aufnehmen.
