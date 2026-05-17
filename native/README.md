# Swing & Savor — Native Wrapper

Capacitor 7 shell that wraps the live PWA at https://app.swingandsavor.at/.

## Identity
- **App ID:** `de.commsconnect.swingandsavor`
- **App Name:** `Swing & Savor`
- **Apple Team:** Comms Connect GmbH (shared org account)
- **Bundle Pattern:** consistent with `de.commsconnect.commsos` per `feedback_app_isolation` (eigener ASC-Key pro App!)

## First-time setup

```bash
cd native
npm install
npx cap add ios
npx cap add android
npm run assets   # generates iOS/Android icons + splashes from native/assets/
npx cap sync
```

## iOS — App Store Connect anlegen
Manuell durch Rainer (Apple ID Login + 2FA):

1. https://developer.apple.com/account/resources/identifiers/list → "+" → App IDs
   - Description: `Swing and Savor`
   - Bundle ID: `de.commsconnect.swingandsavor` (Explicit)
   - Capabilities: keine zusätzlichen nötig (Push later, falls gewünscht)
2. https://appstoreconnect.apple.com/apps → "+" → New App
   - Platforms: iOS
   - Name: `Swing & Savor`
   - Primary Language: German
   - Bundle ID: `de.commsconnect.swingandsavor`
   - SKU: `SWINGSAVOR`
3. ASC-Key generieren (Users and Access → Integrations → App Store Connect API → Generate Key)
   - Name: `Swing & Savor CI`
   - Access: `App Manager`
   - .p8 + Key-ID + Issuer-ID notieren → in `.env.shared` ablegen als:
     ```
     ASC_KEY_ID_SWINGSAVOR=...
     ASC_KEY_ISSUER_ID_SWINGSAVOR=...
     ASC_KEY_P8_BASE64_SWINGSAVOR=...
     ```

## Build & Run

```bash
npm run open:ios    # opens Xcode — Team auf Comms Connect GmbH setzen, dann Run
npm run open:android
```

Bei jedem Code-Change auf der PWA-Seite ist KEIN Rebuild der App nötig — der Wrapper lädt remote von app.swingandsavor.at.
