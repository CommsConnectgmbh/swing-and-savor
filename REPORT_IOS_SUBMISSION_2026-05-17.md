# Swing & Savor — iOS Submission Report

**Datum:** 2026-05-17
**Bundle:** `de.commsconnect.swingandsavor`
**ASC App-ID:** `6770264388`
**Build:** Version 1.0 (Build 1), `47e3c3f6-5e7e-475b-95f9-c80abbf85f35`

## ✅ Was autonom erledigt wurde

### Code-Signing & Provisioning
- ASC API Key `Swing & Savor CI` (`54CMPU58K4`) → `.local-secrets/`
- Bundle-ID `de.commsconnect.swingandsavor` (`9P4854XU6Q`) im Dev-Portal
- ASSOCIATED_DOMAINS-Capability registriert
- Provisioning Profile "Swing and Savor v1.0 App Store" (`VBSFBT5FTT`)
- Distribution Cert reused von Obacht (`2T3UADV229`, läuft bis 2027-04-26)
- 7 GH-Secrets in `CommsConnectgmbh/swing-and-savor`

### CI/CD
- `.github/workflows/ios-release.yml` (macos-26 Runner, iOS 26 SDK)
- `native/scripts/patch-ios-project.mjs` (Privacy-Manifest + Location-Permission + Manual-Signing + XML-Escape-Fix)
- Tag `ios-v1.0.0` → IPA gebaut + zu TestFlight hochgeladen

### App Store Connect Listing (de-DE)
- **Subtitle:** "Match Play, Duelle, Heimatclub"
- **Description:** Features, Kursdatenbank, DSGVO, Kontakt
- **Keywords:** Golf, Match Play, Turnier, Handicap, Scorecard, Golfclub, Duell, Runde, Caddie, Birdie, Eagle
- **Promotional Text + Marketing/Support/Privacy URLs**
- **Categories:** SPORTS (primary) + LIFESTYLE (secondary)
- **Copyright:** © 2026 Comms Connect GmbH
- **Content Rights:** DOES_NOT_USE_THIRD_PARTY_CONTENT

### Age Rating
- Alle Kategorien `NONE`, `unrestrictedWebAccess: true` → 4+ Rating

### Pricing
- Free, alle Territorien

### Build Processing
- State: `VALID`
- Export Compliance: `usesNonExemptEncryption=false`
- Build mit Version 1.0 verlinkt

### TestFlight Internal Testing
- Beta App Localization (de-DE) gesetzt
- Beta App Review Contact: Rainer Roloff, +49 89 4522 1556
- Internal Group "Internal Testing" angelegt (`36595275-94ef-41e9-8bc3-33ff52a24a0f`)
- Build mit Group verlinkt
- Tester: `rainer.roloff@comms-connect.de`

### Screenshots
- 3 Brand-Slides (Match Play / Live-Scoring / Kursdatenbank) in Swing-Savor-Farben
- 6 PNGs hochgeladen: 3 × iPhone 6.9" (1290×2796) + 3 × iPad Pro 12.9" (2048×2732)
- iPhone-Set unter `APP_IPHONE_67` (Apple-API kennt noch keinen `APP_IPHONE_69`)

### Reviewer-Bypass
- Supabase Edge Function `reviewer-bypass` live (verify_jwt=false)
- Credentials: `apple-review@swingandsavor.at` + Code `87654321`
- Smoke-Test: `curl POST` → 200 mit Redirect-Link OK
- Frontend-Hook in `src/screens/SignInScreen.jsx` schon implementiert
- App Store Review Details mit Demo-Account gesetzt + ausführliche Notes für Reviewer

### Review Submission (vorbereitet, blockiert auf 1 manuellen Schritt)
- Review Submission angelegt (`ascReviewSubmissionId` in apple-ids.json)
- Submission-Item kann angelegt werden, sobald App-Privacy-Form ausgefüllt ist
- Re-Run nach Privacy-Form: `node submit-review.js`

## 🚨 EINZIGER blockierender manueller Schritt

### App Privacy Form (ASC Web-UI, ~3 Min)

Apple's Public-API hat **keine Endpunkte** für die App-Privacy-Form — das geht nur über das Web-UI. Habe alle bekannten Endpunkte probiert (404 PATH_ERROR).

**Klick-Pfad:**

1. Öffne https://appstoreconnect.apple.com/apps/6770264388/distribution/privacy
2. Klick **"Get Started"** (oder "Edit", falls schon mal angefangen)
3. Frage 1: **"Do you or your third-party partners collect data from this app?"** → **YES**
4. Wähle folgende Datenarten aus (alle haken):

   **Contact Info:**
   - ✅ Email Address
   - ✅ Name

   **Identifiers:**
   - ✅ User ID

   **Location:**
   - ✅ Coarse Location

5. **Next** → für jede ausgewählte Datenart einzeln:
   - "Is this data used for tracking?" → **No, this data is not used to track**
   - "Is this data linked to the user's identity?" → **Yes, this data is linked to the user**
   - "Purposes" → **App Functionality** (alle anderen NICHT)

6. Nach allen 4 Datenarten: **"Save"** oben rechts → **"Publish"** Button erscheint → klicken

7. Im **"Veröffentlichen"-Dialog** bestätigen

**Danach:**

```bash
cd /Volumes/Code/Projects/swing-and-savor/.apple-bootstrap
node submit-review.js
```

Das submitted die App zur Review.

## 📱 TestFlight ist sofort verfügbar (unabhängig vom Review-Submit)

1. **TestFlight** auf iPhone öffnen (Apple-ID `mail@rainerroloff.de`)
2. "Swing & Savor" erscheint nach 5–15 Min
3. Installieren → läuft als native iOS-App

## 🔗 Quicklinks

- **ASC App:** https://appstoreconnect.apple.com/apps/6770264388
- **App Privacy Form (Blocker):** https://appstoreconnect.apple.com/apps/6770264388/distribution/privacy
- **App Listing (für Review):** https://appstoreconnect.apple.com/apps/6770264388/distribution/info
- **TestFlight Builds:** https://appstoreconnect.apple.com/apps/6770264388/testflight/ios
- **GH CI:** https://github.com/CommsConnectgmbh/swing-and-savor/actions/workflows/ios-release.yml

## 📦 Repo-Artefakte

```
.apple-bootstrap/
  bootstrap.js              # Bundle-ID + Cert + Profile
  create-asc-app.js         # ASC App-ID holen
  set-gh-secrets.js         # 7 GH Secrets
  set-asc-listing.js        # Subtitle/Description/Keywords/Categories/...
  set-age-rating.js         # 4+ Rating
  set-pricing-free.js       # Free, alle Territorien
  wait-for-build.js         # Build-Processing pollen + Export Compliance
  setup-testflight.js       # Beta Localization + Internal Group + Tester + Build-Link
  set-asc-review-details.js # Demo-Account + Reviewer-Notes + Build → Version
  submit-review.js          # reviewSubmission → submitted=true
  probe-privacy.js          # (Diagnose) App-Privacy-API-Endpunkte testen
  secrets/apple-ids.json    # Alle Apple-IDs persistent

.github/workflows/ios-release.yml    # CI build + TestFlight upload

native/scripts/patch-ios-project.mjs # Privacy Manifest + Location + Manual Signing

scripts/asc-screenshots/
  template.html             # 3 Brand-Slides
  render.mjs                # Playwright → 6 PNGs
  upload.mjs                # ASC-Upload (4-step pattern)
  output/                   # 6 finale Screenshots
```

## 🔁 Bei nächstem Release (1.0.1+)

1. `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` in `native/ios/App/App.xcodeproj/project.pbxproj` bumpen
2. `git tag ios-v1.0.1 && git push origin ios-v1.0.1`
3. CI lädt Build hoch
4. `node wait-for-build.js && node setup-testflight.js` → TestFlight aktiv
5. Falls Screenshot-Update: `cd scripts/asc-screenshots && node render.mjs && node upload.mjs`
6. `node submit-review.js` → zur Review
