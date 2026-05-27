# Apple Resubmit 2026-05-26 — Swing & Savor 1.0 (3)

**Submission rejected:** 2026-05-26 11:08 CET, ID `fdb3b1cd-215b-485d-a70b-93d931c200bc`
**Reviewed:** iPad Air 11-inch (M3), iPadOS 26.5
**Two violations of Guideline 2.1(a):**

1. **Performance — App Completeness:** App crashed when reviewer tapped "Take Photo".
2. **Information Needed — Pre-populated Demo Content:** Reviewer-Account hatte beim Login keine sichtbaren Inhalte (Chats / UGC).

---

## Root Cause — Crash

Capacitor 7 / WKWebView ruft beim Tap auf ein `<input type="file" accept="image/*" capture="environment">` den nativen iOS-Foto-Picker auf. iOS terminiert den Prozess **sofort**, wenn `Info.plist` keinen `NSCameraUsageDescription`-String enthält.

Im Code triggern **zwei** Buttons den Picker:
- `src/components/ScorecardSheet.jsx:218` — *"📷 Foto scannen"* (Scorecard-OCR)
- `src/screens/MatchDetailScreen.jsx:614` — *"+ Foto"* (Match-Cover)

`native/ios/App/App/Info.plist` enthielt vor diesem Commit **keinen einzigen** Privacy-Usage-Key — ein klassischer Capacitor-Default-Bug, der erst bei Native-Build sichtbar wird, weil im Browser/PWA der Picker keinen System-Permission-Check macht.

## Fix — Info.plist Privacy Keys

```xml
<key>NSCameraUsageDescription</key>
<string>Swing & Savor uses the camera to scan paper scorecards and to take cover photos for your matches.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Swing & Savor accesses your photo library so you can attach scorecard images and match cover photos.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Swing & Savor saves generated story graphics to your photo library when you tap save.</string>
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

`ITSAppUsesNonExemptEncryption=false` als Bonus gegen den Export-Compliance-Dialog im nächsten TestFlight-Build.

## Fix — Build Bump

`native/ios/App/App.xcodeproj/project.pbxproj`: `CURRENT_PROJECT_VERSION = 2 → 3` (alle vier Build-Configs).

Damit ist die neue Submission **1.0 (3)** — Apple erlaubt keinen Re-Upload mit identischer Build-Nummer.

---

## Root Cause — Demo Content

Die alte `reviewer-bypass` Edge-Function legte den Reviewer-User on-the-fly via `admin.generateLink('magiclink')` an, aber **seedete keinen Content**. Wenn der Reviewer-Account vor dem Review noch nie geloggt war (oder Rainer den Account zwischendurch leerräumt), sah Apple eine komplett leere App.

Rainer hatte zwar manuell ein "Spring Cup 2026"-Turnier angelegt — aber das war ein einzelner Versuch und kein automatischer Seed. Nicht reproduzierbar wenn Apple jemals einen neuen User ansieht.

## Fix — Idempotenter Seed in `reviewer-bypass`

`supabase/functions/reviewer-bypass/index.ts` (Edge-Function v8, ACTIVE auf project `rcqichlyllhwougopfkg`) seedet beim Reviewer-Login **idempotent** folgenden Content:

| Tabelle | Anzahl | Inhalt |
|---|---|---|
| `profiles` | 1 (nur falls noch keins existiert) | Apple Reviewer, hcp 14.3, Royal Demo GC |
| `tournaments` | 1 | "🍃 Apple Review Demo Cup" (public, join_mode open) |
| `players` | 4 | Reviewer + Lena Eagle (Team A) / Sam Birdie + Tom Putter (Team B) |
| `matches` | 2 | 1× Singles finished (Reviewer gewinnt 5&4), 1× Doubles active |
| `hole_results` | 18 + 9 = 27 | komplette 18-Loch Karte für Singles, Front-9 für Doubles |
| `match_comments` | 3 | User-Generated-Content vom Reviewer (Eagle-Story, Putt-Story, GG WP) |
| `match_reactions` | 1 | ❤️ vom Reviewer |

**Idempotenz-Marker:** Tournament-Name `"🍃 Apple Review Demo Cup"` + `owner_id = userId`. Existiert das Turnier schon, retourniert die Function `seeded: false` ohne weiteren Insert.

**Schutz für Rainer:** Wenn bereits ein Profile-Record für den Reviewer-User existiert (z.B. "Tiger W."), wird das Profile *nicht überschrieben* — der Seed nutzt den vorhandenen `display_name` als Spieler-Namen weiter.

### Smoke-Test Resultat

```bash
$ curl -X POST .../reviewer-bypass -d '{"email":"apple-review@swingandsavor.at","code":"87654321"}'
{"email":"apple-review@swingandsavor.at","token_hash":"03f2ea77…","seeded":true}

$ # Re-run → idempotent
{"email":"apple-review@swingandsavor.at","token_hash":"30ad647c…","seeded":false}
```

DB nach Seed (owner = Reviewer-UID `3db4c0fd-…`):
```
🍃 Apple Review Demo Cup  active  public  open         4P  2M  27H  3C
Spring Cup 2026           active  public  invite_only  4P  3M  28H  0C
```

---

## App Review Information — was Rainer manuell in ASC eintragen muss

In *App Store Connect → Swing & Savor → 1.0 → App Review Information*:

| Feld | Wert |
|---|---|
| **Demo Account Username** | `apple-review@swingandsavor.at` |
| **Demo Account Password** | `87654321` |
| **Notes** | "Login via Code: tap 'Senden' on the email screen, then enter the 8-digit code '87654321' on the next screen. The account has a pre-populated public tournament ('🍃 Apple Review Demo Cup') with finished and active matches, scorecards, hole-by-hole scoring, comments and reactions. Camera/photo access prompts appear when tapping 'Foto scannen' on the scorecard or '+ Foto' on a match — both are now safely permission-gated (NSCameraUsageDescription added in build 1.0(3))." |

---

## Release-Pipeline

```bash
# Commit 06b5463 auf main:
git push origin main
git tag -a ios-v1.0.2 -m "Apple resubmit 1.0(3) — camera Info.plist + reviewer demo seed"
git push origin ios-v1.0.2
```

CI Run **26455918202** (`iOS · Release IPA + TestFlight`) auf macos-26 / Xcode 26 / iOS 26 SDK. Erwartet: ~2–3 min Build, dann TestFlight-Upload via `xcrun altool` mit ASC-API-Key `54CMPU58K4`.

Nach erfolgreichem Upload erscheint Build **1.0 (3)** in ASC unter TestFlight → iOS Builds. Sobald processing fertig ist (~10 min nach Upload), in der vorhandenen Submission **fdb3b1cd** das alte Element entfernen, neuen Build **1.0 (3)** auswählen und *"Zur Prüfung übermitteln"* drücken.

---

## Watch-Detach-Saga (drei Commits bis zum grünen Build)

CI durchlief vier Anläufe, weil der Watch-Attach von `bf74d99` an unerwarteten Stellen in das Build-System eingriff:

### Run 1 — `26455918202` ✗ Archive
```
error: "SwingSavorWatch" requires a provisioning profile.
error: Signing for "App" requires a development team.
```
Watch-Target im Xcodeproj wollte ein Profil, das die CI-Pipeline nicht installierte (die Workflow-Logik dafür liegt WIP-dirty im `.github/workflows/ios-release.yml`).

→ **Commit `ec1586e`**: `ruby native/scripts/add-watch-target.rb --detach` lokal ausgeführt.

### Run 2 — `26456139630` ✗ Archive
```
error: Signing for "App" requires a development team.
```
Der Detach-Script entfernte die Target, ließ aber Orphan-`XCBuildConfiguration`-Blöcke zurück. `patch-ios-project.mjs` matched mit non-greedy Regex die **erste** Release-Config — den Watch-Orphan, dessen `CODE_SIGN_STYLE` schon "Manual" war → Patch übersprang die echte App-Target-Config → kein `DEVELOPMENT_TEAM` injiziert.

→ **Commit `9e65e7c`**: awk-Skript stripped die zwei Watch-`XCBuildConfiguration`-Blöcke.

### Run 3 — `26456288185` ✗ Archive
```
error: The file "PrivacyInfo.xcprivacy" couldn't be opened (in target 'App')
builtin-copy .../ios/SwingSavorWatch/PrivacyInfo.xcprivacy → App.app
```
Selbes Spiel mit der Group-Struktur: die orphan `SwingSavorWatch` `PBXGroup` hatte `path = ../SwingSavorWatch` und enthielt ein `Info.plist`. `patch-ios-project.mjs` matched non-greedy `children = (... Info.plist ...);` und hängte den neuen `PrivacyInfo.xcprivacy`-FileRef in die Watch-Group → xcodebuild suchte die Datei unter `../SwingSavorWatch/`.

→ **Commit `96f7b85`**: project.pbxproj komplett auf den Pre-Watch-Stand (`0ddea9f`) zurückgesetzt und nur die `CURRENT_PROJECT_VERSION = 2 → 3`-Bumps reapplied.

### Run 4 — `26456507347` ✓ **erfolgreich**
```
UPLOAD SUCCEEDED with no errors
Delivery UUID: dc78c1bd-3d48-4f57-a950-d2738d6ccf4a
Transferred 8.5 MB in 0.7 s
```
Archive ✓ Export IPA ✓ TestFlight Upload ✓. Build **1.0 (3)** liegt in ASC im Processing.

Für `ios-v1.1.0` muss vor dem Tag-Push:
1. Workflow-Diff (`.github/workflows/ios-release.yml` Watch-conditional-Block) committed werden
2. `ruby native/scripts/add-watch-target.rb` (ohne `--detach`) re-attached die Target
3. ASC App-Record "Apple Watch App" Aktivierung (erscheint nach erstem iOS-only TestFlight-Upload)

Siehe [[reference_swingsavor_watch]] für die vollständige Watch-Pipeline.

## Was *nicht* Teil dieses Commits ist

In `swing-and-savor` blieben dirty im Working-Tree (bewusst ungetraut):
- `.github/workflows/ios-release.yml` (Watch-conditional CI-Logik für v1.1.0)
- `scripts/play-status.mjs` (Play-SA-Pfad-Update für CommsOS-SA-Reuse)

---

## Geänderte Files (4 Commits, in chronologischer Reihenfolge)

| SHA | Subject | Files |
|---|---|---|
| `06b5463` | fix(ios): Apple resubmit 1.0(3) — camera permissions + reviewer demo content | Info.plist + pbxproj + reviewer-bypass/index.ts (3 files, +233/-6) |
| `ec1586e` | fix(ios): detach SwingSavorWatch target for v1.0.2 build | pbxproj (-92) |
| `9e65e7c` | fix(ios): strip orphan Watch XCBuildConfiguration blocks | pbxproj (-51) |
| `96f7b85` | fix(ios): restore pbxproj to pre-Watch state for v1.0.2 build | pbxproj (+2/-62) |

Tag `ios-v1.0.2` zeigt auf `96f7b85`.

## Nächster Schritt für Rainer

Sobald Build 1.0 (3) in ASC durch's Processing ist (~10–15 min):

1. ASC → Swing & Savor → 1.0 → Submission `fdb3b1cd` öffnen
2. Im "iOS-App"-Element den abgelehnten Build (1.0/2) entfernen und Build **1.0 (3)** auswählen
3. App Review Information aktualisieren (siehe oben: `apple-review@swingandsavor.at` / `87654321` + Notes)
4. **Zur Prüfung übermitteln**

Optional vorher noch: TestFlight selbst installieren und testen, dass das Tappen auf "Foto scannen" / "+ Foto" jetzt sauber den iOS-Permission-Dialog zeigt statt zu crashen.
