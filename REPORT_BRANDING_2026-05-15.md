# Swing & Savor — Branding + Native Setup Report
**Datum:** 2026-05-15

## Was wurde gemacht

### A) Logo überall + Grün am Rand (nahtlose Einbettung)
- **Tailwind-Palette** auf Brand-Farben umgestellt:
  - `bg` `#0d271e` (Brand-Dark — App-Hintergrund passt zur Logo-Edge)
  - `brand` `#1f3f2c`, `brandDark` `#0d271e`, `brandGreen` `#98cd02`, `accent` `#98cd02`
- **`src/index.css`:** Body-BG, Focus-Outline, Scrollbar auf Brand umgestellt
- **`src/components/BrandHeader.jsx`** neu: sticky Header mit Logo + "SWING & SAVOR" + Screen-Title
- **`src/App.jsx`:** Header pro Route eingehängt
- **`src/components/BottomNav.jsx`:** Hintergrund rgba(13,39,30) statt Schwarz, Top-Border Brand-Green-Tint
- Active-States bleiben Brand-Green (`feedback_brand_color_active`)

### B) PWA-Icons (komplette Suite)
Generiert aus `Logo.png` in `public/icons/`:
- 16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512, 1024 PNG
- Maskable-Varianten 192 + 512 (Brand-Dark Safe-Area-Bleed für Android Adaptive)
- `apple-touch-icon.png` (180×180) für iOS Add-to-Homescreen
- `favicon-16.png`, `favicon-32.png`
- `logo.png` + `logo-1024.png` als App-internes Asset

### C) iOS Add-to-Homescreen Meta-Tags
- `index.html`: theme-color, apple-touch-icon (alle Größen), apple-mobile-web-app-capable/title/status-bar-style, mobile-web-app-capable
- Vite-PWA `manifest.webmanifest`: name "Swing & Savor", scope "/", start_url "/", icons mit any+maskable purposes

### D) Build-Base von /app/ auf / umgestellt
Für Subdomain `app.swingandsavor.at`:
- `vite.config.js`: `base: '/'`, scope/start_url auf `/`
- `src/main.jsx`: BrowserRouter ohne `basename`
- `public/.htaccess`: `RewriteBase /` (statt `/app/`)
- Build: `dist/` mit 21-Eintrag-Precache, 446 KiB

### E) Capacitor 7 Wrapper /native
- Bundle: `de.commsconnect.swingandsavor`
- AppName: "Swing & Savor"
- `server.url`: https://app.swingandsavor.at (Remote-Wrapper, lädt Live-PWA)
- iOS + Android-Folders mit `npx cap add` scaffolded
- App-Icons + Splash via `@capacitor/assets` aus dem Logo generiert
- Splash-BG `#0d271e` (Brand-Dark, Logo nahtlos eingebettet)

### F) Marketing-Landing `swingandsavor.at` (Apex)
- `marketing/index.html` — statisch, Single-Page, Brand-Gradient, Barlow Condensed
- CTAs: "Zur App" (app.swingandsavor.at) + "Kontakt" (hi@swingandsavor.at)
- Features-Grid: Live / Match Play / PWA
- `vercel.json` mit Cache-Headers + Security-Headers
- Eigenes README für Vercel-Deploy

### G) SETUP.md
Vollständige manuelle Setup-Checkliste für Rainer:
- Cloudflare DNS (apex A + www CNAME + app CNAME)
- 2 Vercel-Projects (marketing + app)
- Apple Developer Bundle-ID anlegen
- App Store Connect App-Record
- ASC API Key + Vars in `.env.shared` als `ASC_*_SWINGSAVOR`
- Play Console + Keystore

## Was Rainer manuell machen muss

1. **Cloudflare DNS** für swingandsavor.at (3 Records, siehe SETUP.md §1)
2. **Vercel-Projects** verbinden + Env-Vars setzen (siehe SETUP.md §2)
3. **Apple Developer Portal:** Bundle-ID `de.commsconnect.swingandsavor` registrieren
4. **App Store Connect:** App-Record "Swing & Savor" anlegen + ASC API Key generieren
5. **Xcode öffnen** (`cd native && npx cap open ios`) und Apple-Team auf Comms Connect GmbH setzen → erstes Archive → TestFlight
6. **Play Console:** App-Record + Keystore (analog)

## Offene Drift-Punkte
- Repo-Ordner heißt noch `golf-cup-pwa/`, GitHub-Remote `CommsConnectgmbh/golf-cup-pwa` — Repo-Rename ist optional, kann später per `gh repo rename`
- Logo zeigt visuell noch "GOLF CUP" als Text — falls der Wortlaut zu "SWING & SAVOR" werden soll, ist ein neuer Logo-Export nötig (Wappen-Stil bleibt, nur Schriftzug ersetzt)
- `Logo.png` ist 1,7 MB groß — committed wäre ok, aber für Repo-Hygiene ggf. zu `assets/` verschieben
