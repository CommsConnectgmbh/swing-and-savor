# Integration Plan — QuickLaunch (GolfLaunchMonitor) as a Pro feature in Swing & Savor

**Date:** 2026-06-14
**Goal:** Offer the GolfLaunchMonitor ("QuickLaunch") AR launch monitor as a paid **Pro** feature *inside* the Swing & Savor iOS app, while **keeping GolfLaunchMonitor as its own git repository**.

> ⚠️ **Build/test note:** This plan and the scaffolded files were authored on a Windows machine with no Xcode. **None of the iOS/Swift code has been compiled.** Every step marked 🔨 must be done and verified on a Mac with Xcode. Treat the scaffolds as a correct-by-construction starting point, not a verified build.

---

## 1. Decisions (locked with the user)

| Decision | Choice |
|----------|--------|
| Linking method | **Embed GolfLaunchMonitor as a Swift Package** (separate repo) and present it via a Capacitor plugin. One shipped app (S&S iOS). |
| Monetization | **Reuse the existing Stripe-via-Edge-Function mechanism** — but as a **new per-user "Pro" entitlement** (see §5). |
| Deliverable | Plan **+ scaffolded code** in both repos. |

### Why a per-user entitlement (important nuance)
The existing Stripe "premium" (`create-premium-checkout`) upgrades a **tournament/cup** (`tournaments.package_type`), not a person. The launch monitor is a **personal, per-device** tool, so it needs an entitlement on the **profile**. We mirror the existing pattern (checkout Edge Function → pending ledger row → reconcile to active) with a new `pro_entitlements` table and `profiles.pro_until` / `profiles.is_pro` flags. The gate is the single helper `isPro(profile)` so the exact product (lifetime / subscription / future StoreKit IAP) can change in one place.

---

## 2. Architecture

```
┌────────────────────────── Swing & Savor (one app) ──────────────────────────┐
│  React SPA (src/)                                                            │
│   /range  → RangeScreen.jsx                                                  │
│      ├─ useProAccess()      ← proAccess.js  ← profiles.pro_until/is_pro       │
│      ├─ probeLaunchMonitor()← launchMonitor.js ─┐                             │
│      └─ openLaunchMonitor() ← launchMonitor.js ─┤ (Capacitor.Plugins)        │
│                                                 ▼                             │
│  iOS native (native/ios/App/App/Plugins/)                                    │
│   LaunchMonitorBridge.swift/.m  (Capacitor plugin, like WatchBridge)         │
│      └─ present() → UIHostingController(QuickLaunchView())                    │
│                          │ import QuickLaunchKit                              │
└──────────────────────────┼───────────────────────────────────────────────────┘
                           ▼  (Swift Package dependency — separate repo)
        ┌──────────────── GolfLaunchMonitor repo ────────────────┐
        │  Package.swift  → library "QuickLaunchKit"             │
        │  QuickLaunch/*.swift  (engine, unchanged)              │
        │  QuickLaunch/QuickLaunchKit.swift → public QuickLaunchView │
        │  QuickLaunchApp.swift (excluded from package; app only)│
        └────────────────────────────────────────────────────────┘
```

**Platform reach:** the feature is iOS + LiDAR only. On web/Android and non-Pro iPhones, `RangeScreen` shows an upsell/"not supported" state instead.

---

## 3. Changes in the GolfLaunchMonitor repo (stays separate)

Scaffolded:
- **`Package.swift`** — declares library product `QuickLaunchKit`, iOS 18, target sources = `QuickLaunch/`, excludes `QuickLaunchApp.swift` (the `@main`) and `Info.plist`, ships `Assets.xcassets` as a resource.
- **`QuickLaunch/QuickLaunchKit.swift`** — `public struct QuickLaunchView: View { ContentView() }` and `public enum QuickLaunchCapability { isSupported }` (delegates to `LiDARDepthProvider.isSupported`). Compiled into the same module, so it re-exposes the otherwise-`internal` `ContentView` without touching every file's access level.

The standalone app is unaffected — `project.yml` / XcodeGen still build it from the same `QuickLaunch/` folder.

🔨 **Verify on Mac:**
- `swift build` (or add the package to a scratch Xcode project) compiles `QuickLaunchKit`.
- **Asset bundle:** any `Image("name")` / `UIImage(named:)` in the engine resolves from `Bundle.main` in the standalone app but must use `Bundle.module` inside the package. Grep the sources; wrap as needed (`Image("x", bundle: .module)`). Color tokens are code-defined (`ContentView.swift`) so they're fine.
- Confirm no source file relies on the app's `Info.plist` keys at compile time (permission strings are runtime, supplied by the host app — see §4).

---

## 4. Changes in the Swing & Savor repo

### Web / React (done, no native build needed to lint)
- **`src/lib/launchMonitor.js`** — Capacitor bridge: `launchMonitorPlatformSupported()`, `probeLaunchMonitor()`, `openLaunchMonitor({isPro})`. No-ops off iOS.
- **`src/lib/proAccess.js`** — `isPro(profile)` + `useProAccess()` hook.
- **`src/screens/RangeScreen.jsx`** — the 4-state gating ladder + Stripe paywall + launch button.
- **`src/App.jsx`** — lazy import + `<Route path="/range" …>` (authenticated).

### iOS native
- **`native/ios/App/App/Plugins/LaunchMonitorBridge.swift` / `.m`** — Capacitor plugin (`isSupported`, `present`). Mirrors `WatchBridge` registration exactly.

🔨 **Manual Xcode / macOS steps (cannot be done here):**
1. **Add the Swift Package dependency** to `native/ios/App/App.xcodeproj`:
   - Xcode → App target → *Package Dependencies* → **+** → add the GolfLaunchMonitor repo URL (or `Add Local…` pointing at `../../GolfLaunchMonitor` during dev) → product **QuickLaunchKit** → add to the **App** target.
   - Pin a tag/branch for reproducible CI builds.
2. **Add the two plugin files to the App target** in Xcode if they aren't auto-included (they live in `App/Plugins/`, same place as `WatchBridge.*`, so the existing file-system group should pick them up — confirm target membership).
3. **Info.plist permission strings** on the **App** target (the engine needs them at runtime):
   - `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSMotionUsageDescription`.
   - Copy the wording from `GolfLaunchMonitor/QuickLaunch/Info.plist`.
4. **Deployment target / capabilities:** App target must be iOS ≥ 18 (engine requirement). ARKit is weak-linked via the package; no extra capability toggle, but ensure the device requirement messaging in §RangeScreen matches.
5. **Orientation lock (known gap):** the capture screens want landscape. QuickLaunch's `OrientationLock` writes to *its own* `AppDelegate.orientationLock`, which does not exist in the Capacitor app. Wire S&S's `AppDelegate` to implement `application(_:supportedInterfaceOrientationsFor:)` reading a shared flag, or accept rotation for v1. Track as follow-up.
6. `npx cap sync ios` after JS build so `www/` and plugin registration refresh.

---

## 5. Supabase / backend

Scaffolded:
- **`supabase/migrations/033_pro_entitlements.sql`** — adds `profiles.pro_until` + `profiles.is_pro`, creates `pro_entitlements` ledger + RLS (users read own; writes service-role only).
- **`supabase/functions/create-pro-checkout/index.ts`** — per-user Stripe checkout (mirrors `create-premium-checkout`); writes a `pending` `pro_entitlements` row; `success_url=/range?pro=success`.

🔨 **To deploy / finish:**
- `supabase db push` (or apply migration) — **first review the existing `profiles` UPDATE RLS policy**: ensure users cannot set `pro_until` / `is_pro` themselves (that would be a free unlock).
- `supabase functions deploy create-pro-checkout` (uses existing `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Payment reconciliation gap (pre-existing):** the codebase has **no Stripe webhook** — `premium_purchases` rows stay `pending`. The same is true here: something must flip `pro_entitlements.status → 'active'` **and** set `profiles.pro_until` when the session completes. Options: add a Stripe webhook Edge Function (recommended), or extend whatever currently reconciles premium. **Until this exists, purchases won't actually grant access.** This is the single most important backend follow-up.

---

## 6. Monetization & App Store policy ⚠️

Per the user's choice we gate on the Stripe-sold entitlement. **Apple's guidelines (3.1.1) require In-App Purchase for unlocking digital features/functionality inside an iOS app.** Selling the launch-monitor unlock via Stripe is a **real App Review rejection risk**. Mitigations / paths:
- **Lowest risk:** add a StoreKit IAP for the iOS Pro unlock; keep Stripe for web. The `isPro` gate and `pro_entitlements` table stay identical — only the activation source changes. (This was offered as the recommended monetization option.)
- If staying Stripe-only: be aware existing premium-via-Stripe may already carry this risk; consult the latest guideline / your prior review history before submitting.

---

## 7. Discoverability (TODO — small)
`/range` is routed but not yet linked from navigation. Add an entry point where it fits your UX (e.g. a tile on `HomeScreen`, an item in `BottomNav`, or a Profile menu row). One line; left to you so it lands in the right place.

## 8. i18n (TODO — small)
`RangeScreen` uses `t('range.*', 'English fallback')`, so it renders correctly today. Add a `range` block to the 5 locale files (`src/locales/{de,en,es,fr,ja}.json`) to localize properly.

---

## 9. End-to-end verification checklist

- [ ] 🔨 `QuickLaunchKit` builds as a package (`swift build`).
- [ ] 🔨 Standalone GolfLaunchMonitor app still builds (XcodeGen unaffected).
- [ ] 🔨 SPM dependency added to S&S App target; `import QuickLaunchKit` resolves.
- [ ] 🔨 Plugin files in App target; `Capacitor.Plugins.LaunchMonitorBridge` exists at runtime.
- [ ] 🔨 Camera/Mic/Motion permission strings present on App target.
- [ ] `npm run build` (web) passes; `RangeScreen` lints/loads; web shows the iOS-only upsell.
- [ ] On a LiDAR iPhone (12 Pro+): `/range` → paywall → Stripe checkout opens.
- [ ] Migration applied; `pro_entitlements` RLS verified; `profiles` not user-writable for pro fields.
- [ ] Reconciler/webhook flips entitlement to active and sets `profiles.pro_until`.
- [ ] After unlock, `/range` shows **Open Launch Monitor**; tapping presents the QuickLaunch UI full-screen and a shot can be captured.
- [ ] 🔨 Orientation behaves acceptably on the capture screens.

---

## 11. CI — Codemagic (manual trigger only)

`codemagic.yaml` adds the workflow **`ios-swingsavor-testflight`** that builds the iOS app on a cloud Mac so the integration can be compiled without a local Mac. It mirrors the proven `.github/workflows/ios-release.yml` build (Capacitor → `cap sync` → `patch-ios-project.mjs` → `pod install` → archive → export → optional TestFlight), translated to Codemagic.

- **Triggering:** `triggering.events: []` → **no automatic builds** (no push/PR/tag, including pushes to `main`). Start every build manually from the Codemagic UI/API. (GolfLaunchMonitor's existing `codemagic.yaml` is already manual-only the same way — nothing to change there.)
- Because the iOS shell loads from the remote URL (`app.swingandsavor.at`), this build compiles the **native plugin + the QuickLaunchKit Swift Package** — the real integration compile check. The JS paywall ships separately via Vercel.

🔨 **One-time Xcode prerequisite (the build fails without it):**
`LaunchMonitorBridge.swift` does `import QuickLaunchKit`, so the package must be a dependency of the App project. In Xcode → App target → *Package Dependencies* → **+** → add `https://github.com/olihoffmann/GolfLaunchMonitor.git`, pin a branch/tag, product **QuickLaunchKit** → App target. Commit the resulting `project.pbxproj` change. (Capacitor regenerates parts of the iOS project, so verify the SPM reference survives a `cap sync`.)

🔨 **Codemagic UI setup (account-specific, can't be scripted here):**
1. Connect the `CommsConnectgmbh/swing-and-savor` repo to Codemagic.
2. Create env-var group **`swingsavor_signing`** with the values listed at the top of `codemagic.yaml` — reuse the **same** cert/profile/ASC secrets already in your GitHub Actions secrets, plus a **`GLM_REPO_TOKEN`** (a GitHub PAT with read access to the private GolfLaunchMonitor repo) so SPM can resolve QuickLaunchKit.
3. Trigger the workflow manually. Set `UPLOAD_TO_TESTFLIGHT=false` for a pure compile/export check before shipping.

## 10. Files added/changed by this scaffold

**GolfLaunchMonitor repo**
- `Package.swift` (new)
- `QuickLaunch/QuickLaunchKit.swift` (new)

**Swing & Savor repo**
- `native/ios/App/App/Plugins/LaunchMonitorBridge.swift` (new)
- `native/ios/App/App/Plugins/LaunchMonitorBridge.m` (new)
- `src/lib/launchMonitor.js` (new)
- `src/lib/proAccess.js` (new)
- `src/screens/RangeScreen.jsx` (new)
- `src/App.jsx` (edited — lazy import + `/range` route)
- `supabase/migrations/033_pro_entitlements.sql` (new)
- `supabase/functions/create-pro-checkout/index.ts` (new)
- `codemagic.yaml` (new — manual-trigger iOS build)
- `INTEGRATION_LAUNCH_MONITOR.md` (this file)
