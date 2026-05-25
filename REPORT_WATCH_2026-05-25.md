# Apple Watch Companion — Phase 1

**Datum:** 2026-05-25
**Branch:** main (uncommitted)
**Scope:** Companion-only watchOS-App, kein eigener Auth-Flow.

---

## Architektur

```
┌─────────────────┐       WCSession        ┌─────────────────┐
│  iPhone App     │ ─── updateContext ───▶ │  Apple Watch    │
│  (Capacitor)    │                        │  (SwiftUI)      │
│                 │ ◀── sendMessage ─────  │                 │
│  WebView ───────┤                        │  ScoreEntryView │
│  app.swing.at   │                        │  Digital Crown  │
└─────────────────┘                        └─────────────────┘
       │                                            │
       │ React → Capacitor.Plugins.WatchBridge      │
       │                                            │
       ▼                                            ▼
   Supabase                              Lokaler JSON-Cache
   (hole_results upsert)                 (Watch wieder-launch)
```

**Trennung:**
- Watch **liest** keine Supabase-Daten direkt (kein eigener Auth-Token, kein Trust-Surface).
- Watch **schreibt** keine Daten direkt (Score geht via Phone-Web → bestehende Supabase-Logik).
- Phone-Web ist Single Source of Truth, Watch ist UI-Mirror + Eingabe.

## Komponenten

### Native iOS (`native/ios/App/App/Plugins/`)
- **`WatchBridge.swift`** — Capacitor-7-Plugin mit 3 Methoden + 2 Listeners.
  - `publishMatch(payload)` → `WCSession.updateApplicationContext()` (+ `sendMessage` falls reachable).
  - `clearMatch()` → schickt `{kind: "clear"}` und löscht App-Context.
  - `isAvailable()` → `{paired, installed, reachable}` für Debug-UI.
  - Empfängt `kind: "score"` von der Uhr → emittiert Capacitor-Event `watchScoreEntered`.
- **`WatchBridge.m`** — `CAP_PLUGIN`-Macro für ObjC-Runtime-Registrierung.

### watchOS (`native/ios/SwingSavorWatch/`)
- **`SwingSavorWatchApp.swift`** — `@main` SwiftUI-App, ein StateObject `MatchStore`.
- **`WatchMatch.swift`** — Codable-Model + Convenience-Computeds (nextHole, matchPlayWins, totalsAB).
- **`MatchStore.swift`** — `WCSessionDelegate`, sendScore via Message + `transferUserInfo`-Fallback, optimistisches Local-Update, JSON-Cache in Application Support Directory für cold-launch.
- **`ContentView.swift`** — Empty-State („Öffne ein Match auf deinem iPhone") oder Match-Anzeige.
- **`MatchSummaryView.swift`** — Score-Header, primärer „Loch X eintragen"-Button, 18-Hole-Grid (3×6).
- **`ScoreEntryView.swift`** — Hole-Detail mit Digital-Crown-Eingabe, Team-A/B-Switch per Tap, Quick-Buttons Birdie/Par/Bogey/+2, Haptic-Feedback, Send + Dismiss.

### Web (`src/`)
- **`lib/watchBridge.js`** — Thin Capacitor-Wrapper: `publishMatchToWatch`, `clearWatchMatch`, `onWatchScore`, `onWatchRefreshRequest`, `buildWatchPayload`. No-op auf non-iOS.
- **`screens/MatchDetailScreen.jsx`** — useEffect:
  1. Pushed Match-Payload bei Mount + bei jeder `holes`/`status`-Änderung.
  2. Subscribed auf `watchScoreEntered` → `applyHoleFromWatch(holeNum, sa, sb)` (Upsert + status='active' falls 'pending').
  3. Clear-on-unmount.

### Xcode-Integration (`native/scripts/add-watch-target.rb`)
- Idempotentes Ruby-Script via `xcodeproj` gem.
- Erstellt SwingSavorWatch-Target (watchOS 10.0, WKApplication=true), setzt Build-Settings, bindet 6 Swift-Files + Assets.xcassets ein.
- Embedded Watch Content Build Phase (subfolderSpec=16, `$(CONTENTS_FOLDER_PATH)/Watch`) auf iOS App Target.
- Wired auch das WatchBridge-Plugin (Swift + .m) in die iOS-App-Sources.
- Liest `APPLE_TEAM_ID` + `IOS_WATCH_PROFILE_NAME` aus ENV für CI-Signing.

### CI (`.github/workflows/ios-release.yml`)
- Neuer Step: `gem install xcodeproj` + `ruby add-watch-target.rb` nach `patch-ios-project.mjs`.
- Optionaler Step: `Install Watch provisioning profile` (gated auf `secrets.IOS_WATCH_PROVISIONING_PROFILE_BASE64`).
- `ExportOptions.plist` listet beide Bundle-IDs falls Watch-Profil-Secret gesetzt ist.

## Daten-Format (Phone → Watch)

```json
{
  "matchId": "uuid",
  "teamAName": "Heim",
  "teamBName": "Auswärts",
  "playersA": "Rainer · Max",
  "playersB": "Anna · Lisa",
  "typeLabel": "Doubles · Stableford",
  "format": "match_play",
  "status": "active",
  "cupName": "Sommercup 2026",
  "courseName": "GC München-Riedhof",
  "holes": [
    { "holeNumber": 1, "par": 4, "strokesA": 5, "strokesB": 4 },
    ...
  ]
}
```

## Daten-Format (Watch → Phone)

```json
{
  "kind": "score",
  "matchId": "uuid",
  "holeNumber": 7,
  "strokesA": 4,
  "strokesB": 5,
  "_ts": 1748213456.234
}
```

## Manuelle Schritte für TestFlight-Roll-Out

1. **Apple Developer Portal**
   - App-ID `de.commsconnect.swingandsavor.watchkitapp` registrieren (Capabilities: leer reicht).
   - Provisioning Profile „Swing and Savor v1.0 WatchKit App Store" erzeugen (App Store Distribution, signed mit Comms-Connect-Cert `2T3UADV229`).

2. **GitHub Secrets** (`CommsConnectgmbh/swing-and-savor` → Settings → Secrets → Actions):
   - `IOS_WATCH_PROVISIONING_PROFILE_BASE64` = base64 des `.mobileprovision`.
   - Kein eigenes Cert nötig — Watch nutzt dasselbe Distribution-Cert wie iOS.

3. **App Store Connect**
   - Im bestehenden App-Record `6770264388`:
     - Bei der nächsten Version → Apple Watch App aktivieren (Section „App Information" → „Apple Watch") — das Watch-Build erscheint automatisch nach erstem TestFlight-Upload.

4. **Release-Tag pushen**
   ```bash
   cd /Volumes/Code/Projects/swing-and-savor
   git add -A
   git commit -m "feat(watch): companion watchOS app with score entry"
   git tag ios-v1.1.0
   git push origin main ios-v1.1.0
   ```
   CI baut beide Targets, lädt nach TestFlight.

## Bekannte Lücken (Phase 2)

- **Standings-View** auf der Uhr (Live-Leaderboard fürs ganze Turnier) — aktuell zeigt Watch nur das eine geöffnete Match.
- **Hand-Off**: iPhone-Match-Detail → Apple-Watch Continuity ist nicht verdrahtet.
- **Complication** (Always-On-Watchface-Mini-Score) — TimelineProvider + ComplicationDescriptor noch nicht angelegt.
- **Offline-Queue**: `transferUserInfo` puffert zwar bis Phone aufwacht, aber UI zeigt keinen Pending-Status.

## Test-Plan (lokal mit echtem iPhone + Watch)

1. `npm run build && cd native && npx cap sync ios && npx cap open ios`.
2. Xcode → Scheme "App" auf physisches iPhone (gepaart mit Watch).
3. Watch sollte automatisch installieren (Build-Phase „Embed Watch Content").
4. Phone-App öffnen → in einem Match auf `/matches/:id` navigieren.
5. Watch-App öffnen — Match erscheint mit Empty-Holes.
6. Loch 1 auf der Uhr antippen → Crown drehen für Team A → Tap auf Team B → Crown drehen → „Speichern".
7. Phone-Web (im WebView sichtbar) sollte Loch-1 mit den Strokes anzeigen, hole_results-Row in Supabase prüfen.

## Files-Inventar (16 neu, 2 geändert)

| Pfad | Status |
|---|---|
| `native/ios/App/App/Plugins/WatchBridge.swift` | neu |
| `native/ios/App/App/Plugins/WatchBridge.m` | neu |
| `native/ios/SwingSavorWatch/SwingSavorWatchApp.swift` | neu |
| `native/ios/SwingSavorWatch/WatchMatch.swift` | neu |
| `native/ios/SwingSavorWatch/MatchStore.swift` | neu |
| `native/ios/SwingSavorWatch/ContentView.swift` | neu |
| `native/ios/SwingSavorWatch/MatchSummaryView.swift` | neu |
| `native/ios/SwingSavorWatch/ScoreEntryView.swift` | neu |
| `native/ios/SwingSavorWatch/Info.plist` | neu |
| `native/ios/SwingSavorWatch/Assets.xcassets/Contents.json` | neu |
| `native/ios/SwingSavorWatch/Assets.xcassets/AppIcon.appiconset/Contents.json` | neu |
| `native/ios/SwingSavorWatch/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` | neu |
| `native/ios/SwingSavorWatch/Assets.xcassets/LaunchBackground.colorset/Contents.json` | neu |
| `native/scripts/add-watch-target.rb` | neu |
| `src/lib/watchBridge.js` | neu |
| `REPORT_WATCH_2026-05-25.md` | neu |
| `src/screens/MatchDetailScreen.jsx` | geändert |
| `.github/workflows/ios-release.yml` | geändert |
| `native/ios/App/App.xcodeproj/project.pbxproj` | geändert (Watch-Target eingehängt) |
