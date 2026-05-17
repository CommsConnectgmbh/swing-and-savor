# Swing & Savor iOS Submission — Was Rainer manuell tun muss

Stand: 2026-05-17. Code-Pipeline (GitHub Actions → TestFlight) ist live, Build 1.0/1 ist hochgeladen. Was bis zur Apple-Review noch fehlt, ist nicht code-bar — das sind ASC-Maschinen-Eingaben.

## Wo: App Store Connect
https://appstoreconnect.apple.com → Apps → **Swing & Savor** (`6770264388`)

## 1. App Privacy (Pflicht, sonst APP_DATA_USAGES_REQUIRED)

App Privacy → Edit. Datensammlung deklarieren:

| Datentyp                 | Verwendung           | Verknüpft mit ID | Tracking |
|--------------------------|----------------------|-------------------|----------|
| E-Mail-Adresse           | App-Funktionalität   | Ja                | Nein     |
| Name                     | App-Funktionalität   | Ja                | Nein     |
| Foto/Video (User-Inhalte) | App-Funktionalität  | Ja                | Nein     |
| Standortdaten (grob)     | App-Funktionalität   | Ja                | Nein     |
| Identifikatoren (User-ID) | App-Funktionalität  | Ja                | Nein     |
| Diagnose (Crash-Logs)    | Analyse              | Nein              | Nein     |

Nach Save: **oben rechts auf „Veröffentlichen" klicken** — wenn das vergessen wird, kommt der Submit-Fail. Reference: `feedback_asc_privacy_publish` (Memory).

## 2. Reviewer-Credentials

App-Information → App Review Information:
- Sign-in required: **Yes**
- User name: `apple-review@swingandsavor.at`
- Password: `87654321`
- Notes:
  > Tap "Anmelden", gib die obige E-Mail ein, dann den 8-stelligen Code 87654321 als OTP. Das ist ein Bypass-Account ohne echte E-Mail (Edge Function `reviewer-bypass`). Anschließend siehst du Home-Feed, Matches, Cup-Anlegen, Friends, Messaging und Rangliste.

Der Bypass akzeptiert genau diese E-Mail-Adresse + diesen Code, hardcodiert in der Edge Function `reviewer-bypass` (Supabase Project `rcqichlyllhwougopfkg`).

## 3. App Store Page (1.0)

App Store → 1.0 Prepare for Submission:

**Promotional Text** (170 Zeichen, änderbar ohne Review):
> Cups mit Freunden, Live-Scoring auf jedem Loch, Flight-Matches mit Faktoren, DMs und globale Rangliste. Match Play und Stableford — schnell, intuitiv, ohne Schnickschnack.

**Description**:
> Swing & Savor ist die Golf-App für Freundes-Cups: Match Play oder Stableford spielen, Flights bis 4-gegen-4 mit fairen Faktoren bei ungleicher Spielerzahl, Live-Scoring Loch für Loch.
>
> • Home-Feed: Was deine Freunde gerade spielen, live mit Score, Foto, Cup-Kontext.
> • Duelle: 1-gegen-1 herausfordern, ELO sammelst du automatisch.
> • Rangliste: Welt oder nur Freunde — sieh wie du dich schlägst.
> • Nachrichten: 1:1-DMs unter Freunden, Realtime.
> • Tour-Tab: PGA, DP World, LPGA, Majors — Highlights und Live-Scores als Bridge.
>
> Alles im einheitlichen Design, ohne Werbung, ohne Tracking jenseits dessen, was für die App-Funktion nötig ist.

**Keywords** (100 Zeichen):
> Golf,Match Play,Stableford,Scorecard,Turnier,Cup,Handicap,Flight,Score,Live,Leaderboard,PGA

**Support URL**: `https://swingandsavor.at/impressum`
**Marketing URL**: `https://swingandsavor.at`

**Screenshots** (Pflicht, mindestens 1 pro Gerät — iPhone 6.7"):
- Home-Feed mit Live-Match
- Match Detail mit Live-Scoring (Loch 7, 3 UP)
- Flight 4v3 Create-Form mit Faktor-Auto-Ausgleich
- Foto-Cover auf Match
- Rangliste mit Top-3
- DM-Thread

Tipp: aus dem Browser-Devtools (iPhone 14 Pro Max Viewport) screenshotten → 1290×2796.

## 4. Build wählen

In der 1.0-Page → Build → Build 1.0/1 auswählen (sollte bereits da sein nach TestFlight-Upload).

**Falls Build nicht erscheint**: TestFlight → Internal Testing → muss „Ready to Submit" sein. Compliance-Fragen beantworten (Encryption: Standard-iOS-HTTPS-Encryption, kein eigener Krypto-Code).

## 5. Age Rating

Setzen → keinerlei sensitive Inhalte, sollte 4+ ergeben. Falls 17+ rauskommt: Frage „Unrestricted Web Access" mit Yes beantwortet? Setzen auf No, weil der Tour-Tab nur kuratierte YouTube-Embeds zeigt, keinen offenen Browser.

## 6. Submit for Review

Save → Add for Review → Submit. Erste Review dauert üblicherweise 24–48h.

**Falls Rejected:**
- Häufig: Reviewer kommt nicht durch Auth → Notes prüfen, evtl. Screenshot der OTP-Eingabe in den Notes anhängen.
- DSGVO/Account-Löschung: bereits implementiert über `/me` → „Konto unwiderruflich löschen" + Edge Function `delete-account`. Reviewer sehen das im Profile-Screen.

## Android (Play Store) — parallel

Die GH-Actions-Pipeline `android-release.yml` ist live, lädt automatisch zu Play Internal-Track via `SWINGSAVOR_PLAY_SERVICE_ACCOUNT_JSON`. Was Rainer manuell tun muss:

1. Play Console → App erstellen `Swing & Savor`, Bundle `de.commsconnect.swingandsavor`.
2. Internal Testing Track → Tester-Liste anlegen (mindestens 12 Mails für Production-Submission).
3. App Content: Datenschutzerklärung-URL `https://swingandsavor.at/datenschutz`, Datensicherheit-Form (analog zu iOS Privacy), Zielgruppe ab 18 (oder All ages).
4. Ersten AAB manuell hochladen (CI braucht den App-Record als Voraussetzung).
5. Sobald App-Record existiert: CI deployed bei jedem `android-vX.Y.Z`-Tag auto.

Reviewer-Bypass funktioniert identisch über `play-review@swingandsavor.at` + Code `87654321` (Reference: `reference_obacht_play_reviewer` für das Pattern).
