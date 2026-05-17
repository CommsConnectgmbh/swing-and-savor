# Swing & Savor — Review + Fixes 2026-05-17

## TL;DR
- Profile-anlegen-Bug nach Reload behoben (Auth-Race + transiente Fehler überschrieben Profile).
- App spürbar schneller: Route-Splitting + Vendor-Chunks (Initial-JS klein, Screens lazy).
- DealBuddy-Verknüpfung jetzt direkt aus Freunden, Profil und Challenge-Form heraus.
- Marketing-Landing (swingandsavor.at) komplett neu — spiegelt den vollen Funktionsumfang.
- Beide Vercel-Deploys live: HTTP 200 auf swingandsavor.at + app.swingandsavor.at.

## Bug-Analyse: "Reload → Profil anlegen, danach Logout/Login nötig"

**Root cause** (in `src/lib/auth.jsx`):

`AuthProvider` rief `loadProfile` doppelt auf:
1. Manuelles `supabase.auth.getSession()` beim Mount → `loadProfile(uid)`.
2. `onAuthStateChange` feuert in supabase-js v2 zusätzlich `INITIAL_SESSION` direkt nach `subscribe()` → setzt `profileChecked=false` und ruft erneut `loadProfile(uid)`.

Beide Calls liefen parallel. Wenn einer durch einen kurzen RLS/Netzwerk-Hiccup `null` zurückgab, machte der bisherige Code:

```js
const p = await fetchProfileWithRetry(uid)
setProfile(p)               // ← bei null wurde das gültige Profil überschrieben
setProfileChecked(true)
```

→ App rendert `OnboardingScreen` ("Profil anlegen"), obwohl das Profil in der DB existiert.

Zusätzlich feuerte `TOKEN_REFRESHED` (ca. stündlich / nach Visibility-Change) den gleichen Pfad erneut.

**Fix** (vollständig):
- `loadProfile` dedupliziert per `inflightUidRef` und `loadedUidRef`.
- Neuer `NOT_FOUND`-Sentinel unterscheidet "Row existiert nicht" (legitim → Onboarding) von "Fetch fehlgeschlagen" (transient → bestehenden State **nicht** anfassen).
- `TOKEN_REFRESHED` / `USER_UPDATED` lösen kein Reload mehr aus.
- `SIGNED_IN` / `INITIAL_SESSION` laden nur, wenn sich die UID geändert hat.
- `setProfileDirect` aktualisiert `loadedUidRef`, damit anschließende Events nicht neu fetchen.

## Performance

`vite.config.js`:
- `manualChunks`: `supabase`, `react`, `router`, `vendor` als separate Chunks (langfristig cachebar).
- `target: es2020`, `cssCodeSplit: true`.

`src/App.jsx`:
- `React.lazy` für alle Screens außer SignIn/Onboarding (Welcome-Flow).
- `Suspense`-Fallback nutzt vorhandenen Brand-Spinner.

Bundle (gzipped) vorher (monolithisch) → nachher:
- supabase chunk: 44 kB (lädt einmal, danach gecacht)
- react chunk: 44 kB (einmal)
- entry: 7.7 kB
- Erste Screen (Board): 3.7 kB
- ChallengesScreen / MatchDetail / Profile: 4–5 kB on-demand

## DealBuddy-Verknüpfung

**Lib (`src/lib/dealbuddy.js`)**
- Neu: `challengeFriendOnDealBuddy(friend, extra?)` — one-call deep link.
- `buildChallengePostUrl` sendet jetzt zusätzlich `opponent_handle` → DealBuddy kann den User in-app auflösen.

**FriendsScreen**
- Jede akzeptierte Friend-Row hat zwei neue Buttons: "Duell" (in-app) und "💰" (DealBuddy direkt mit prefill).

**ProfileScreen (foreign view /u/:handle)**
- Bei befreundetem Status: "Herausfordern" (in-app) + "💰 DealBuddy"-Button + dezenter "✓ Befreundet"-Status.

**ChallengesScreen**
- Liest `?opponent=<uid>` aus der URL und öffnet das Create-Formular mit dem Gegner vorbelegt.
- Im Create-Formular: neuer Sekundär-Button "💰 Direkt auf DealBuddy herausfordern →".

## Marketing-Landing (swingandsavor.at)

Komplett neu — vorher: Single-Screen-Hero mit 3 Tags. Jetzt:
- Nav mit Brand-Mark + Links + "Zur App"-CTA.
- Hero mit echtem Lead, Meta-Stats (1.745 Plätze, Live Scoring, PWA + Native).
- 6-Feature-Grid: Match Play, Cup Bracket, Live-Leaderboard, 1.700+ Plätze, Freunde & Duelle, Match-Statistik.
- 3-Step-"Wie es geht"-Erklärer.
- **DealBuddy-Band** mit eigenem Gradient + Crosslink.
- Plattform-Sektion (Web / iOS / Android).
- Bottom-CTA-Band + Footer mit Impressum/Datenschutz-Links.
- Auf Brand (dark green Gradient, Brand-Green Accent, Barlow Condensed). Mobile-first.

## Deploys (live)
- App: `dpl_8WnyKRGkgbF3sHc4AK7k79n7GwXk` → app.swingandsavor.at HTTP 200.
- Website: `dpl_HHzNS8AZzmnMQJtCaNQBtuPsFa5f` → swingandsavor.at HTTP 200.

## Nicht angefasst (bewusst)
- `dist/`, `pwa_build/`, `deploy_upload*` — Legacy-Build-Artefakte, jetzt in `.gitignore`.
- `.apple-bootstrap/` — bleibt lokal, enthält Bootstrap-Tooling (Secrets-Unterordner war ohnehin ignoriert).
- Capacitor-Native-Wrapper (`native/`) — wurde nur committed, kein Code-Change. Native-App lädt remote, profitiert automatisch vom App-Deploy.

## Verifikations-Schritte für Rainer
1. `app.swingandsavor.at` öffnen, eingeloggt: Profil bearbeiten → Speichern → **Hard-Reload** (Cmd+Shift+R). Du solltest direkt im Board landen, nicht in "Profil anlegen".
2. `/friends`: bei akzeptierten Freunden sind jetzt "Duell" + "💰"-Buttons sichtbar.
3. Klick auf "💰" bei Freund → DealBuddy öffnet mit Gegner-Name + Handle vorbelegt.
4. `swingandsavor.at` öffnen: neue Landing-Page ist live.
