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
- `native/scripts/patch-ios-project.mjs` (Privacy-Manifest + Location-Permission + Manual-Signing)
- Tag `ios-v1.0.0` → IPA gebaut + zu TestFlight hochgeladen
- Delivery UUID: `47e3c3f6-5e7e-475b-95f9-c80abbf85f35`

### App Store Connect Listing (de-DE)
- **Subtitle:** "Match Play, Duelle, Heimatclub"
- **Description:** vollständig (Features, Kursdatenbank, DSGVO, Kontakt)
- **Keywords:** Golf, Match Play, Turnier, Handicap, Scorecard, Golfclub, Duell, Runde, Caddie, Birdie, Eagle
- **Promotional Text:** vollständig
- **Marketing URL:** https://swingandsavor.at
- **Support URL:** https://swingandsavor.at
- **Privacy Policy URL:** https://swingandsavor.at/datenschutz.html
- **Categories:** SPORTS (primary) + LIFESTYLE (secondary)
- **Copyright:** © 2026 Comms Connect GmbH
- **Content Rights:** DOES_NOT_USE_THIRD_PARTY_CONTENT

### Age Rating
- Alle Kategorien `NONE`, `unrestrictedWebAccess: true` (WebView)
- Ergibt 4+ Rating
- Kein Gambling, kein UGC-public, keine Werbung

### Pricing
- Free, alle Territorien (USA-Base, Free PricePoint)

### Build Processing
- Build wurde von Apple verarbeitet (State `VALID`)
- Export Compliance: `usesNonExemptEncryption=false` gesetzt (nur HTTPS, keine proprietäre Verschlüsselung)

### TestFlight Internal Testing
- Beta App Localization (de-DE) gesetzt
- Beta App Review Contact: Rainer Roloff, +49 89 4522 1556
- Internal Group "Internal Testing" angelegt (`36595275-94ef-41e9-8bc3-33ff52a24a0f`)
- Build mit Group verlinkt
- Tester: `rainer.roloff@comms-connect.de` (war bereits als Team-User registriert)

## 📱 Was du jetzt tun kannst

### TestFlight-App installieren
1. Öffne **TestFlight** auf deinem iPhone
2. Login mit deiner Apple-ID (`mail@rainerroloff.de`)
3. "Swing & Savor" sollte unter Apps erscheinen
4. Installieren → läuft live als native iOS-App

Apple braucht in der Regel weitere 5–15 Min nach `VALID`-Status, bis der Build in der TestFlight-App sichtbar ist.

## ❌ Was noch fehlt für Public App Store

### Screenshots (Pflicht für Submit)
Apple verlangt für die Submission:
- 6.7" iPhone (1290 × 2796 px) — mindestens 3, max 10
- 6.5" iPhone (1242 × 2688 px) — optional, kann automatisch skaliert werden
- iPad Pro 12.9" (2048 × 2732 px) — falls iPad-Support

**Empfehlung:** Auf iPhone die App via TestFlight nutzen, native Screenshots der wichtigsten Screens:
- Login
- Board (Turnier-Übersicht)
- Match Detail (Live-Scoring)
- Profile (Stats)
- Discover (Public Turniere)

### App Privacy Form
Im ASC Web-UI auszufüllen (kann nicht 100 % via API):
- ✅ Email Address — Linked, App Functionality, Not Tracking
- ✅ Name — Linked, App Functionality, Not Tracking
- ✅ Coarse Location — Linked, App Functionality, Not Tracking (nur Course-Nearby)
- ✅ User Content (Photos/Videos der Avatar) — Linked, App Functionality
- ✅ Identifiers — User ID (Auth) Linked, App Functionality

URL: https://appstoreconnect.apple.com/apps/6770264388/distribution/privacy

### Reviewer-Bypass für Email-OTP
Die App nutzt Email-OTP-Login. Apple-Reviewer können nicht auf rainer.roloff@... zugreifen. Empfehlung wie bei Obacht:
- Statischen Bypass-Code für `apple-review@swingandsavor.at` in der Auth-Edge-Function
- In Beta App Review Details + AppStore Review Details als Demo-Credentials eintragen

### Submit für Review
Wenn Screenshots + Privacy Form + Reviewer-Bypass durch:
1. ASC → Swing & Savor → "iOS App 1.0"
2. Build auswählen (sollte automatisch verlinkt sein nach Encryption-Flag)
3. "Add for Review" → "Submit for Review"

## 🔗 Quicklinks

- **ASC App:** https://appstoreconnect.apple.com/apps/6770264388
- **TestFlight Builds:** https://appstoreconnect.apple.com/apps/6770264388/testflight/ios
- **App Listing:** https://appstoreconnect.apple.com/apps/6770264388/distribution/info
- **CI Workflow:** https://github.com/CommsConnectgmbh/swing-and-savor/actions/workflows/ios-release.yml

## 📦 Repo-Artefakte

- `.apple-bootstrap/secrets/apple-ids.json` — alle Apple-IDs persistent
- `.apple-bootstrap/{bootstrap,create-asc-app,set-gh-secrets,set-asc-listing,set-age-rating,set-pricing-free,wait-for-build,setup-testflight}.js`
- `.github/workflows/ios-release.yml`
- `native/scripts/patch-ios-project.mjs`

## 🔁 Bei nächstem Release (1.0.1+)

1. `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` in `native/ios/App/App.xcodeproj/project.pbxproj` bumpen
2. `git tag ios-v1.0.1 && git push origin ios-v1.0.1`
3. CI lädt Build hoch, Build erscheint in TestFlight
4. Optional: `node setup-testflight.js` neu, um Build zur Internal Group hinzuzufügen
