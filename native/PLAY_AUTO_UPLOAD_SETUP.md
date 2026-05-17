# Swing & Savor — Play Auto-Upload Setup

CI lädt jeden Release-Build automatisch in den Google-Play-Internal-Track,
sobald das Service-Account-Secret gesetzt ist.

## Voraussetzungen
- Play-Console-App-Record `de.commsconnect.swingandsavor` muss existieren
  (siehe REPORT_NATIVE_LAUNCH_2026-05-17.md, Manual-Step 4).
- Erster AAB-Upload muss **manuell** über Play Console laufen, damit Google
  das Bundle-Mapping initialisiert. Erst danach klappt API-Upload.

## Service-Account-Key wiederverwenden (Cross-App OK)

Memory `feedback_play_sa_cross_app.md`: Roloff-Android-Apps dürfen sich
einen Play-Service-Account teilen.

Wir nutzen die SA aus dem CommsOS-Projekt:
- SA-Email: `commsos-play-publisher@comms-play-publisher.iam.gserviceaccount.com`
- JSON liegt unter `C:\Claude Code\.env.shared` Backup (oder im
  CommsOS-Repo unter `.local-secrets/play-service-account.json`).

### Schritte
1. In **Play Console > Setup > API access** den SA für die Swing-&-Savor-App
   einladen (Permissions: Release Manager auf App-Level).
2. SA-JSON in GitHub-Secret `SWINGSAVOR_PLAY_SERVICE_ACCOUNT_JSON`
   (CommsConnectgmbh/swing-and-savor) einfügen.
3. Im Workflow `android-release.yml` ist der Upload-Step bereits scharf:
   sobald das Secret gesetzt ist, läuft der Upload nach jedem Build.

## Lokaler Test

```bash
cd /Volumes/Code/Projects/swing-and-savor
npm run build
rm -rf native/www && cp -R dist native/www
cd native && npx cap sync android
cd android && ./gradlew assembleDebug
```

Sollte ohne Keystore durchlaufen (Debug-Signing) und APK unter
`native/android/app/build/outputs/apk/debug/` ablegen.
