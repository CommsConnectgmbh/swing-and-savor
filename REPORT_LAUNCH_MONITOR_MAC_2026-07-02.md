# Report — QuickLaunch (Launch Monitor) Mac-Integration, 2026-07-02

Ausgeführt auf dem Mac (Xcode 26.6). Deploy-Key kam nachgereicht → Native-Integration technisch komplett verifiziert; es fehlt nur noch **ein Schreibzugriff**, um die Package-Änderung ins GLM-Repo zu landen.

## ✅ Erledigt & verifiziert

### Web / Pro-Freischaltung (live)
- **PR #49 gemergt** (`feat: expose Pro launch monitor (entry point + i18n)`) → `main` (Commit `2a4da46`), Checks grün, Vercel-Prod deployt automatisch, `app.swingandsavor.at` → 200.
- Damit ist die „Launch Monitor — PRO"-Card + `range.*`-i18n (de/en/es/fr/ja) live.

### QuickLaunchKit Swift Package (GLM-Repo, Branch `feat/quicklaunchkit-spm`, Commit `40ef9d7` — lokal, noch nicht gepusht)
Die Engine `olihoffmann/GolfLaunchMonitor` als embeddbares Package `QuickLaunchKit` verpackt. **Der ursprüngliche Scaffold war nie kompiliert** — beim echten Build kamen 3 reale Fehler hoch, alle sauber gefixt:
1. **`Package.swift` Platform:** `.iOS(.v18)` ist unter swift-tools 5.9 nicht verfügbar → String-Form `.iOS("18.0")`.
2. **Asset-Farben:** `Color("BrandAccent")` / `UIColor(named: "BrandAccent")` (6 Stellen) wurden aus `Bundle.main` gesucht → im Host (S&S) kaputt. Neu: `Bundle.quickLaunchResources` (`#if SWIFT_PACKAGE ? .module : .main`) — funktioniert in Package UND Standalone-App.
3. **OrientationLock:** griff auf app-only `AppDelegate` zu (im Package excluded) → engine-eigener `QuickLaunchOrientation.lock` (public); Standalone-AppDelegate liest jetzt daraus.

**Deployment-Target-Entscheidung (der „Blocker" aus den Notizen):** Engine-Floor ist echt **iOS 18** (nutzt `.symbolEffect(.breathe)`), und `project.yml` zielt selbst auf 18. Package-Floor auf 14 zu senken hieße die 4.000-Zeilen-Engine mit `@available` zu zerlegen — fragil, gegen die tägliche Autonomous-Firm. Sauber: **iOS 18** für Package + S&S-App. Jedes LiDAR-Gerät (iPhone 12 Pro+) läuft ≥18 → kein Reichweitenverlust fürs Feature; für die Basis-App praktisch irrelevant (2026er-Remote-Shell-Golf-App).

**Verifiziert (`xcodebuild BUILD SUCCEEDED`, generic/iOS):**
- QuickLaunchKit als Package
- Standalone QuickLaunch-App (kein Regress durch meine Änderungen)
- **S&S-App mit lokal eingebundenem Package** → `import QuickLaunchKit` löst, `LaunchMonitorBridge.swift/.m` kompilieren im App-Target, Asset-Bundle landet in `App.app`. Die zentrale Unsicherheit der Notizen („or step 2 fails") ist widerlegt.

### S&S-Seite technisch bewiesen (lokal, wieder zurückgesetzt — kommt committable mit Remote-Tag)
- SPM-Produkt `QuickLaunchKit` ans App-Target; `LaunchMonitorBridge.swift/.m` echt ins Target (waren vorher 0 Referenzen — auch WatchBridge ist übrigens unreferenziert).
- Info.plist: `NSMicrophoneUsageDescription` + `NSMotionUsageDescription` ergänzt, `NSCameraUsageDescription` um Launch-Monitor erweitert.
- App-Deployment-Target 14 → 18.

## ✅ GELANDET (2026-07-03) — Schreibzugriff kam per write-Deploy-Key
1. **GLM:** Package auf `main` gelandet (`d261732`) + Tag `quicklaunchkit-v1.0.0`. QuickLaunchKit baut (`xcodebuild`).
2. **S&S PR #54 gemergt** (`95789b6`): SPM-Dep auf QuickLaunchKit (kanonische `git@github.com:…`-URL, gepinnt auf Revision `d261732`, `Package.resolved` committet), `LaunchMonitorBridge.swift/.m` im App-Target, Info.plist-Strings, Deployment-Target 18.
3. **Verifiziert:** `xcodebuild BUILD SUCCEEDED` (App-Workspace, generic/iOS) — QuickLaunchKit **vom Remote** geholt & gepinnt gecheckt, `import QuickLaunchKit` löst, beide Bridge-Dateien kompilieren ins App-Target.

## ✅ In TestFlight (2026-07-03) — lokal gebaut, CI abgelöst
- **Swing & Savor 1.2.0 (Build 18)** mit dem Pro-Launch-Monitor lokal auf dem Mac gebaut, signiert (`iPhone Distribution: Comms Connect GmbH`) und zu App Store Connect hochgeladen → Build-State **VALID**, in TestFlight testbar.
- **CI wurde abgelöst statt repariert:** GitHub-Actions bräuchte einen `workflow`-Scope-Token (durch Org-OAuth-Restriktion blockiert) + CI-Deploy-Key — für null Vorteil, da der always-on Mac Cert, ASC-Key und SSH-Zugang zum privaten Package schon hat.
- **Neue committete Pipeline:** `scripts/release-ios-local.sh` (build→sign→package→upload) + `.apple-bootstrap/fetch-profile.js` (holt das aktuelle Profile per Name aus ASC — die Profile-ID rotiert bei Capability-Änderungen). Nutzung: `scripts/release-ios-local.sh 1.2.1 19` (`--no-upload` für reine IPA).
- Stolperfallen unterwegs gelöst: veraltetes lokales Profile ohne **Push** → frisches per ASC-API; **Xcode-26-`exportArchive`-Bug** → IPA von Hand aus dem signierten Archive gepackt; Marketing-Version-Bump 1.1.4→**1.2.0** (alter Train geschlossen).

## ✅ Zahlungs-Blocker gelöst (2026-07-03) — Kauf schaltet jetzt real frei
Beim Draufschauen: **das Pro-Backend (Migration 033) war nie deployed** und **nichts aktivierte einen Kauf** → zahlen schaltete nichts frei. Sauber behoben & deployed auf `rcqichlyllhwougopfkg`:
- **Migration 034:** `is_pro`/`pro_until` + `pro_entitlements`-Ledger (+RLS) + `stripe_payment_intent_id`; **BEFORE-UPDATE-Trigger** gegen Self-Grant (nur service_role darf die Flags ändern — `profiles_update_self` erlaubte sonst gratis-Pro; RLS kann OLD/NEW nicht vergleichen).
- **stripe-webhook** (bestehender Endpoint erweitert, Secret schon konfiguriert): aktiviert `pro_entitlements` bei `checkout.session.completed` (product=launch_monitor) → `status=active` + `profiles.is_pro/pro_until`; expired/failed + Refund-Revoke. Premium/Boost unangetastet.
- **create-pro-checkout** deployed (lag nur im Repo).
- Verifiziert: Self-Grant geblockt / service_role erlaubt; simulierter Checkout flippt pending→active und setzt `is_pro`. PR #57 gemergt.
- **Rainers Konto (`rainer`) auf Pro** gesetzt (auditierbarer Comp-Entitlement) → Sofort-Test in TestFlight ohne Kauf.

## 🔜 Verbleibende Schritte
1. **Device-Test** über TestFlight (Build 18) auf dem iPhone 17 Pro — das AR-Feature real ausprobieren (Konto ist Pro).
2. **Vor Production (App-Store 3.1.1):** iOS-Unlock sauber via StoreKit-IAP statt Stripe. Der `isPro`-Gate + `pro_entitlements` bleiben identisch, nur die Aktivierungsquelle wechselt (App-Store-Server-Notifications statt Stripe-Webhook).

## Weiterhin offen (inhaltlich, unabhängig vom Build)
- **App-Store 3.1.1:** Pro-Unlock via Stripe statt IAP = reales Reject-Risiko. Sauber: StoreKit-IAP für iOS, Stripe nur Web (`isPro`-Gate bleibt).
- **Kein Stripe-Webhook:** `pro_entitlements` bleiben `pending` → Kauf schaltet real nicht frei, bis Reconciler/Webhook `status→active` + `profiles.pro_until` setzt.
