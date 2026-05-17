# Swing & Savor — Hosting & iOS Setup

Status: **2026-05-15 scaffolded**, awaiting Rainer to complete the manual steps below.

---

## 1) Cloudflare DNS für `swingandsavor.at`

> Voraussetzung: Domain ist beim Registrar gekauft, Nameserver auf Cloudflare gesetzt
> (Empfohlen, weil alle anderen Roloff-Domains in Cloudflare liegen — siehe `reference_cloudflare_account_token`).

In Cloudflare → swingandsavor.at → DNS:

| Type  | Name | Target                      | Proxy | Notes                              |
|-------|------|-----------------------------|-------|------------------------------------|
| A     | @    | 76.76.21.21                 | Off   | Vercel apex (marketing landing)    |
| CNAME | www  | cname.vercel-dns.com        | Off   | www → marketing (Vercel)           |
| CNAME | app  | cname.vercel-dns.com        | Off   | app subdomain → PWA build (Vercel) |

Proxy "Off" (DNS-only) ist Pflicht, damit Vercel SSL eigenständig issued.

## 2) Vercel-Projects

Zwei separate Projects, beide auf das **CommsConnectgmbh-GitHub-Org** verbunden (siehe `reference_github_org_pat`):

### a) `swingandsavor-marketing` → Apex + www
- Repo: dieses Repo (oder eigenes splitten, später)
- Root Directory: `marketing/`
- Framework Preset: Other
- Build Command: *(leer)*
- Output Directory: `.`
- Domains: `swingandsavor.at`, `www.swingandsavor.at`

### b) `swingandsavor-app` → app.swingandsavor.at (PWA)
- Repo: dieses Repo
- Root Directory: *(repo root)*
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Env-Vars (Production):
  - `VITE_SUPABASE_URL` = (aus .env.local übertragen)
  - `VITE_SUPABASE_ANON_KEY` = (aus .env.local übertragen)
- Domains: `app.swingandsavor.at`

Git author muss `rainer.roloff@comms-connect.de` sein, sonst blockt Vercel (siehe `reference_git_identity`).

## 3) Apple Developer / App Store Connect

Apple Team: **Comms Connect GmbH** (Org-Account aus `reference_apple_developer`).
Eigene Identity pro App — kein Default-Sharing mit anderen Roloff-Apps (`feedback_app_isolation`).

### Bundle-ID anlegen
1. https://developer.apple.com/account/resources/identifiers/list
2. "+" → App IDs → App → Continue
3. Description: `Swing and Savor`
4. Bundle ID: **Explicit** `de.commsconnect.swingandsavor`
5. Capabilities: keine zusätzlichen jetzt (Push/Sign-in-with-Apple ggf. später)
6. Continue → Register

### App Store Connect Record
1. https://appstoreconnect.apple.com/apps → "+" → New App
2. Platforms: iOS
3. Name: `Swing & Savor`
4. Primary Language: German
5. Bundle ID: `de.commsconnect.swingandsavor`
6. SKU: `SWINGSAVOR`
7. User Access: Full Access

### ASC API Key (für CI/Fastlane später)
1. ASC → Users and Access → Integrations → App Store Connect API → "+"
2. Name: `Swing & Savor CI`
3. Access: `App Manager`
4. Download `.p8` SOFORT (geht nur einmal!)
5. Issuer-ID + Key-ID notieren
6. In `/Volumes/Code/ClaudeCode/.env.shared` ergänzen (Suffix-Style, siehe `reference_belegify_asc_naming`):
   ```
   ASC_KEY_ID_SWINGSAVOR=...
   ASC_KEY_ISSUER_ID_SWINGSAVOR=...
   ASC_KEY_P8_BASE64_SWINGSAVOR=$(base64 -i AuthKey_XXXX.p8)
   ```

### Native build & TestFlight upload
Erst-Setup auf dem Mac:
```bash
cd native
npm install            # bereits gelaufen
npx cap open ios       # öffnet Xcode
```
In Xcode:
- Target App → Signing & Capabilities → Team: **Comms Connect GmbH**
- Bundle Identifier: `de.commsconnect.swingandsavor` (auto)
- Build phase: Run on Simulator zum Test
- Archive → Distribute → App Store Connect → TestFlight

## 4) Android (Play Store)

Cross-App Service Account erlaubt (siehe `feedback_play_sa_cross_app`):
- SA: `commsos-play-publisher@comms-play-publisher.iam.gserviceaccount.com`
- Play Console → Apps → "+" → Create App
- App name: `Swing & Savor`
- Package name: `de.commsconnect.swingandsavor`
- Default language: German – Germany
- App or game: App
- Free or paid: Free

Keystore separat halten (`feedback_app_isolation`):
```bash
keytool -genkey -v -keystore native/android/swingandsavor.keystore \
  -alias swingandsavor -keyalg RSA -keysize 4096 -validity 25000
```
Keystore + Passwort an Cloudflare-Storage / GitHub Secrets binden, niemals committen.

---

## Mini-Checkliste (Rainer manuell)

- [ ] Cloudflare: 3 DNS-Records gesetzt
- [ ] Vercel: 2 Projects mit korrekten Domains
- [ ] Supabase env-Vars in Vercel-App-Project
- [ ] Apple Developer: Bundle-ID `de.commsconnect.swingandsavor` registriert
- [ ] App Store Connect: App-Record angelegt
- [ ] ASC API Key generiert + in .env.shared
- [ ] Xcode: Team gesetzt, ein Run auf Simulator durchgelaufen
- [ ] Play Console: App-Record + Keystore generiert
