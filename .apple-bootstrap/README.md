# Swing & Savor — Apple iOS Bootstrap

Vollautonome Provisionierung der iOS-Code-Signing-Pipeline.

## Strategie

Apple-Limit: max **2 aktive IOS_DISTRIBUTION-Certs pro Team**. Comms Connect GmbH
hat DealBuddy + Obacht (Belegify reused bereits Obacht). Swing & Savor reused
**ebenfalls Obachts Distribution Cert** — Apple-Cert ist app-agnostisch.

ASC-API-Key dagegen ist **strikt pro App** (feedback_app_isolation.md): eigener
Key `Swing & Savor CI`, gespeichert unter `.local-secrets/AuthKey_<KEYID>.p8`.

## Ablauf (einmalig)

### Schritt 1 — manuell in ASC (~1 Minute)

Neuen ASC API Key anlegen:

1. https://appstoreconnect.apple.com/access/integrations/api
2. `+` neben "Active Keys" → "Generate API Key"
3. Name: **`Swing & Savor CI`**
4. Access: **Admin**
5. "Generate" → **`.p8` herunterladen** (geht nur 1× möglich)
6. `.p8` nach `/Volumes/Code/Projects/swing-and-savor/.local-secrets/AuthKey_<KEYID>.p8` legen
7. Key-ID + Issuer-ID in `/Volumes/Code/ClaudeCode/.env.shared` ergänzen:
   ```
   ASC_KEY_ID_SWINGSAVOR=<KEYID>
   ASC_ISSUER_ID_SWINGSAVOR=ff3129ef-46de-4c16-8bfc-31a16b85b655
   ASC_API_KEY_PATH_SWINGSAVOR=/Volumes/Code/Projects/swing-and-savor/.local-secrets/AuthKey_<KEYID>.p8
   ```

### Schritt 2 — Bundle-ID + Cert + Profile (autonom)

```bash
cd /Volumes/Code/Projects/swing-and-savor/.apple-bootstrap
npm install
node bootstrap.js
```

Output: Bundle-ID `de.commsconnect.swingandsavor` + ASSOCIATED_DOMAINS-Capability
+ Provisioning Profile "Swing and Savor v1.0 App Store" in Apple Dev Portal.

### Schritt 3 — manuell App-Record in ASC (~30 Sek)

`POST /v1/apps` ist Apple-API-verboten, einmaliger Klick nötig:

1. https://appstoreconnect.apple.com/apps → "+" → "New App"
2. Platform: **iOS**
3. Name: **Swing & Savor**
4. Primary Language: **German (de-DE)**
5. Bundle ID: **de.commsconnect.swingandsavor** (Dropdown — erscheint nach Schritt 2)
6. SKU: **SWINGSAVOR-IOS-001**
7. User Access: **Full Access**
8. "Create"

### Schritt 4 — ASC App-ID + GH-Secrets (autonom)

```bash
node create-asc-app.js   # holt ASC App-ID
node set-gh-secrets.js   # uploads 7 GH-Secrets in CommsConnectgmbh/swing-and-savor
```

### Schritt 5 — Build + TestFlight

```bash
cd /Volumes/Code/Projects/swing-and-savor
git tag ios-v1.0.0
git push origin ios-v1.0.0
```

GH-Actions baut IPA via macos-26 (iOS 26 SDK) → upload zu TestFlight.

## Was `secrets/` enthält (gitignored)

| Datei | Inhalt |
|---|---|
| `apple-ids.json` | Apple-Resource-IDs + P12-Password + ASC-App-ID |
| `swingsavor-distribution.p12` | Distribution Cert (reused Obacht) |
| `SwingSavor_AppStore.mobileprovision` | Provisioning Profile |

## Re-Run

Idempotent: Bundle ID + Profile werden bei Re-Run nicht doppelt erzeugt.
`bundleIdCapabilities POST` gibt bei Re-Run 409 ("already exists") — okay.
