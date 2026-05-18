# Swing & Savor Play Console Setup + Golf Cup Deprecation

**Stand 2026-05-18.** Im Play Console läuft noch der alte App-Record `Golf Cup / com.golfcup.app` (Production-Track als Draft, nie released). Swing & Savor bekommt einen **neuen** App-Record unter `de.commsconnect.swingandsavor`, weil sich der Package-Name geändert hat — Play Store lässt das nicht über den alten Record updaten.

Vorbedingung erledigt:
- ✅ Bundle `de.commsconnect.swingandsavor` in `native/android/app/build.gradle:applicationId`
- ✅ `SWINGSAVOR_KEYSTORE_*` Secrets im Repo (siehe `project_swing_and_savor.md` Status 2026-05-17)
- ✅ `SWINGSAVOR_PLAY_SERVICE_ACCOUNT_JSON` Secret im Repo
- ✅ Reviewer-Bypass live (`play-review@swingandsavor.at` + Code `87654321`)

## Was zu tun ist

### 1. Golf Cup deaktivieren
Play Console → Golf Cup auswählen → **App-Einstellungen → Erweiterte Einstellungen → App-Verfügbarkeit**:

- Wenn Production-Track schon released war: **App im Play Store ausblenden** (Unpublish-Toggle)
- Wenn nur Draft (laut API-Check ist nur Draft drin): **App löschen** ist nicht möglich, aber den Draft verwerfen + die App im Konto verstecken — sie bleibt sichtbar in der Console, aber niemand kann sie installieren

Begründung im internen Audit-Log eintragen: „Brand-Wechsel zu Swing & Savor, neuer Package-Name `de.commsconnect.swingandsavor`."

### 2. Swing & Savor App-Record anlegen
Play Console → **Alle Apps → App erstellen**:

| Feld | Wert |
|------|------|
| App-Name | `Swing & Savor` |
| Standardsprache | `Deutsch (Deutschland) – de-DE` |
| App oder Spiel | `App` |
| Kostenpflichtig oder gratis | `Gratis` |
| Erklärungen | beide Häkchen |

→ **App erstellen**

### 3. Pflicht-Formulare ausfüllen
- **App-Inhalt → Datenschutzerklärung:** `https://swingandsavor.at/datenschutz`
- **App-Zugriff:** „Manche Funktionen erfordern Login — Test-Account: `play-review@swingandsavor.at` + Code `87654321` (8-stelliger OTP-Bypass)"
- **Werbeanzeigen:** Nein
- **Inhalts-Rating:** Sport/Lifestyle, keine Glücksspiel-Elemente (DealBuddy-Crosslink ist nur Deep-Link, kein In-App-Gambling)
- **Zielgruppe:** Ab 18
- **Datensicherheit:** Email + Display-Name + Handicap + Spielstatistiken (alles user-provided)

### 4. Cross-App-Service-Account freigeben
Play Console → **Nutzer und Berechtigungen** → `commsos-play-publisher@comms-play-publisher.iam.gserviceaccount.com`:

- App-Zugriff: **Swing & Savor** zur App-Liste hinzufügen
- Berechtigungen pro App (gleich wie CommsOS):
  - ✅ App-Informationen anzeigen
  - ✅ Tests verwalten
  - ✅ Release zu Testtracks
  - ❌ Release zu Production-Track

**Hinweis:** Das Repo nutzt `SWINGSAVOR_PLAY_SERVICE_ACCOUNT_JSON`. Falls dieser Secret eine **andere** SA enthält (eigener, separater Key für Swing & Savor), muss DIESE SA freigegeben werden, nicht commsos-play-publisher. Bitte den Inhalt des Secrets in der GH-UI prüfen.

### 5. Erste signed AAB manuell hochladen
Im Repo läuft der `android-release.yml`-Workflow auf Tag `android-v*`. Erster Tag-Push baut den signed AAB:

```bash
cd /Volumes/Code/Projects/swing-and-savor
git tag android-v1.0.0
git push origin android-v1.0.0
```

**Erster Lauf wird beim Play-Upload-Step fehlschlagen** („Package not found"), weil Play das erste AAB manuell verlangt. AAB-Artifact aus dem Action-Run herunterladen → Play Console → **Tests → Internal Testing → Neues Release → AAB hochladen**.

### 6. CI übernimmt ab Tag 2
Alle weiteren `android-v*`-Tags laden via Play API automatisch hoch.

## Pre-Check vor Schritt 5

```bash
grep -E 'versionCode|versionName' /Volumes/Code/Projects/swing-and-savor/native/android/app/build.gradle
```

Erwartet aktuell: `versionCode 1` + `versionName "1.0"` → matcht Tag `android-v1.0.0`.

## Was Rainer dabei NICHT vergessen darf

- **Keystore-Backup:** `.local-secrets/` muss offline gespiegelt sein (gleiche Regel wie Belegify/Obacht). Verlust = neuer App-Record im Play Store nötig, weil Play den ersten Upload-Key forever bindet.
- **Listing-Assets:** Screenshots (mind. 2× 6.5" Phone), Feature-Graphic (1024×500) + Hi-Res-Icon (512×512). Vorlagen unter `ASO_LISTINGS.md` und `public/`.
- **Golf-Cup-Bestandskunden:** Es gab nie ein Production-Release (nur Draft), also keine Migrationsmail nötig.
