# Apple Review Reject Fix — Build 1.0 (1) → 1.0 (2)

Datum: 2026-05-19
Submission-ID (rejected): `2d10a7f1-8630-4804-9cb6-87af69bcfb9f`
Review-Datum: 2026-05-18 (iPad Air 11" M3, iPadOS 26.5)

## Apple-Findings

### Guideline 2.1(a) — Performance / App Completeness

> The app exhibited one or more bugs that would negatively impact users.
> Bug description: The app redirected us to the browser after confirming the code.

**Root Cause**
Der Reviewer-Bypass nutzte `admin.generateLink('magiclink')` und gab den
kompletten `action_link` (auf `rcqichlyllhwougopfkg.supabase.co`) als
`redirect` an das Frontend. Das Frontend rief
`window.location.href = redirect` auf — in der Capacitor-WebView reißt das
aus der App raus, weil die Ziel-Origin (`supabase.co`) nicht zur Capacitor-
Origin (`app.swingandsavor.at`) passt. iOS öffnet dann Safari.

**Fix** (HEAD `e57ea0e`)
- `supabase/functions/reviewer-bypass/index.ts`: gibt jetzt
  `{ email, token_hash }` zurück statt `{ redirect }`.
- `src/screens/SignInScreen.jsx`: ruft `supabase.auth.verifyOtp({type:
  'magiclink', token_hash })` direkt im Frontend auf. Keine Navigation,
  keine externe Origin, Session wird in-place gesetzt.

Smoke-Test:
```
$ curl -X POST .../functions/v1/reviewer-bypass \
    -d '{"email":"apple-review@swingandsavor.at","code":"87654321"}'
→ {"email":"...","token_hash":"…"}

$ curl -X POST .../auth/v1/verify -d '{"type":"magiclink","token_hash":"…"}'
→ {"access_token":"eyJ…"}
```
Production-Bundle auf `app.swingandsavor.at` enthält `token_hash` und ist
live (verifiziert via Grep im ausgelieferten JS).

### Guideline 2.3.10 — Performance / Accurate Metadata

> The app or metadata includes information about third-party platforms …
> Revise the app's screenshots to remove non-iOS status bar images.

**Root Cause**
Die 6 ASC-Screenshots (3× iPhone 6.7", 3× iPad 12.9") rendern eine
Mock-Status-Bar mit "9:41" und drei schwarzen Dots `● ● ●` als
Signal/Wifi/Battery-Platzhalter. Apple bewertet das als
"non-iOS status bar".

**Fix**
- `scripts/asc-screenshots/template.html`: Status-Bar-Funktion gibt jetzt
  nur einen leeren `.top-spacer` zurück. Phone-Frame mit Rounded Corners
  + Bezel reicht als Device-Andeutung.
- 6 Screenshots neu gerendert (`node render.mjs`).
- 6 Screenshots zu ASC-Locale `de-DE` neu hochgeladen (bestehendes Set
  wurde geleert, neue Assets reserved + uploaded + finalized).

## Re-Submit-Flow

Build 1 reichte nicht — Apple öffnet keine neue Review-Runde ohne neuen
Build.

1. `CURRENT_PROJECT_VERSION` in `native/ios/App/App.xcodeproj/project.pbxproj`
   1 → 2 (Marketing-Version `1.0` bleibt).
2. Commit `0ddea9f` + Tag `ios-v1.0.1` gepusht → GH-Actions
   `ios-release.yml` Run #26064863100 lief grün durch.
3. `scripts/asc-screenshots/resubmit.mjs` automatisiert:
   - Wartet bis Build 2 in ASC `processingState=VALID` erreicht.
   - Zuordnet Build 2 zur Version 1.0.
   - Storniert die alte `UNRESOLVED_ISSUES`-ReviewSubmission.
   - Erstellt neue ReviewSubmission, hängt die Version als Item an,
     setzt `submitted=true`.

## Reply für Apple Reviewer

```
Hello,

Thanks for the detailed review. Both issues have been addressed in build 1.0 (2).

— 2.1(a) Browser redirect after code confirmation
  The previous build used a Supabase action_link to verify the reviewer
  account, which navigated the WebView to a supabase.co URL and caused
  the system to open Safari. We replaced that flow: the verification
  endpoint now returns a token hash, and the app calls
  supabase.auth.verifyOtp({ token_hash }) directly. The session is
  created in place — no navigation, no external browser. Verified on
  iPad Air 11" simulator (iPadOS 26.5).

— 2.3.10 Non-iOS status bar in screenshots
  The previous screenshots included a mock status bar. All 6 iPhone /
  iPad screenshots have been re-rendered without any status bar
  imagery and re-uploaded.

Reviewer credentials are unchanged:
  Email: apple-review@swingandsavor.at
  Code:  87654321

Thank you for the time spent re-reviewing.
Best,
Rainer Roloff
```

## Status (final)

- [x] Edge Function deployed → smoke: liefert `token_hash`, kein `redirect`
- [x] Production-Bundle `index-BfR4Ymkv.js`: `token_hash` 2× vorhanden, `window.location.href=redirect` 0×
- [x] verifyOtp({token_hash}) liefert access_token (804 chars) + refresh_token
- [x] 6 Screenshots re-rendered + zu ASC-de-DE hochgeladen (Status-Bar entfernt)
- [x] Build 2 CI-grün, ASC `processingState=VALID`, `usesNonExemptEncryption=false`, Build-ID `1a12099e-89dd-4ab9-8345-227d92daeb0b`
- [x] Alte UNRESOLVED_ISSUES-Submission (`2d10a7f1-…`) storniert
- [x] Neue ReviewSubmission `fdb3b1cd-215b-485d-a70b-93d931c200bc` → **WAITING_FOR_REVIEW** (2026-05-18 22:52 UTC)
- [x] **Review Notes der Version 1.0 mit Reject-Fix-Erklärung aktualisiert** (`appStoreReviewDetail` `6204c458-…`) — Reviewer sieht das im Submission-Detail
- [x] Smoke-Test komplett: Auth-Flow funktioniert in-app ohne externe Navigation

Nichts mehr offen. Sobald Apple den Slot bearbeitet, sollte der Review durchgehen — sämtliche bemängelten Punkte sind technisch behoben und im neuen Build/Set live.
