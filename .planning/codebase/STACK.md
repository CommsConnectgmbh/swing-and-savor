# Technology Stack

**Analysis Date:** 2026-06-14

## Languages

**Primary:**
- JavaScript (ES2020) - All React frontend source in `src/` (`.jsx`, `.js`)
- TypeScript - All Supabase Edge Functions in `supabase/functions/` (`.ts`, Deno runtime)

**Secondary:**
- Swift - iOS native layer in `native/ios/App/App/AppDelegate.swift` and `native/ios/App/App/Plugins/WatchBridge.swift`
- Objective-C - iOS plugin bridge in `native/ios/App/App/Plugins/WatchBridge.m`
- SQL - Database schema and migrations in `supabase/migrations/`

## Runtime

**Web Frontend:**
- Node.js 20 (specified in GitHub Actions: `native/.github/workflows/ios-release.yml`)
- Build target: ES2020 (`vite.config.js`)

**Edge Functions:**
- Deno (Supabase Edge Runtime) - all functions in `supabase/functions/` import from `https://esm.sh/`

**Package Manager:**
- npm (root, native, discord, scripts/asc-screenshots)
- Lockfile: `package-lock.json` present at root

## Frameworks

**Core:**
- React 18.2.0 - UI component framework (`src/`)
- React Router DOM 6.30.4 - Client-side SPA routing (`src/App.jsx`)

**Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS (`tailwind.config.js`)
- PostCSS 8.5.6 + Autoprefixer - CSS processing (`postcss.config.js`)
- Custom CSS: `src/cc-glassnav.css`, `src/index.css`

**Internationalization:**
- i18next 26.2.0 + react-i18next 17.0.8 - i18n framework
- i18next-browser-languagedetector 8.2.1 - Auto language detection
- 5 locales: de, en, es, fr, ja (`src/locales/`)

**Mobile Native Shell:**
- Capacitor 7.0.1 - Web-to-native bridge (`native/package.json`)
  - `@capacitor/ios` 7.0.1
  - `@capacitor/android` 7.0.1
  - `@capacitor/push-notifications` 7.0.6 - Native push (iOS/Android)
  - `@capacitor/haptics` 7.0.1
  - `@capacitor/splash-screen` 7.0.1
  - `@capacitor/status-bar` 7.0.1
  - `@capacitor/browser` 7.0.1
  - `@capacitor/app` 7.0.1
- Custom native plugin: `WatchBridge` (Swift + ObjC) in `native/ios/App/App/Plugins/`

**Testing:**
- Vitest 4.1.6 - Test runner (configured in `vite.config.js` under `test:`)
- jsdom 24.1.3 - Browser environment emulation
- @testing-library/react 14.3.1 - React component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- @testing-library/jest-dom 6.9.1 - DOM assertions
- Playwright 1.60.0 - E2E testing (present as devDep, usage extent unclear)

**Build/Dev:**
- Vite 6.4.2 - Dev server and bundler (`vite.config.js`)
- @vitejs/plugin-react 4.7.0 - React fast refresh + JSX transform
- Sentry Vite Plugin 5.3.0 - Source map upload to Sentry at build time

**Bot/Tooling:**
- discord.js 14.16.3 - Discord server setup bot (`discord/`)
- google-auth-library 10.6.2 - Google auth (devDep, likely for scripts)
- jose 6.2.3 - JWT utilities (devDep, likely for scripts)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.98.0 - Database, Auth, Realtime, Storage client (`src/lib/supabase.js`)
- `@sentry/react` 10.56.0 - Error monitoring + performance tracing (`src/sentry.js`)
- `react-router-dom` 6.30.4 - All navigation; SPA routing with `<BrowserRouter>` (`src/main.jsx`)
- `i18next` 26.2.0 - All user-facing strings; removal would break all localized UI

**Infrastructure:**
- `qrcode` 1.5.4 - QR code generation for invite links (`src/components/QrCodeSheet.jsx`)
- Stripe SDK (Deno, via esm.sh) - Payments in Edge Functions; `stripe@14` used in `supabase/functions/create-premium-checkout/index.ts` and `supabase/functions/create-boost-checkout/index.ts`
- `@negrel/webpush@0.3.0` (Deno, via esm.sh) - VAPID web push delivery in `supabase/functions/send-push/index.ts`
- `discord.js` 14.16.3 - Discord guild setup in `discord/`

## Configuration

**Environment (frontend):**
- `VITE_SUPABASE_URL` - Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key (required)
- `VITE_VAPID_PUBLIC_KEY` - VAPID public key for Web Push (optional; push disabled if absent)
- `SENTRY_AUTH_TOKEN` - Sentry source map upload (build-time only, via `vite.config.js`)

**Environment (Supabase Edge Functions):**
- `SUPABASE_URL` - Injected automatically by Supabase
- `SUPABASE_ANON_KEY` - Injected automatically
- `SUPABASE_SERVICE_ROLE_KEY` - Secret, used by checkout + push functions
- `STRIPE_SECRET_KEY` - Stripe server secret key
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` - VAPID keys for `send-push`
- `RESEND_API_KEY` - Transactional email for `widerruf` withdrawal confirmations

**Environment (Discord bot):**
- `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CLIENT_ID` (see `discord/.env.example`)

**Build:**
- `vite.config.js` - Vite config with manual chunk splitting (react, supabase, router, vendor)
- `tailwind.config.js` - Custom design tokens (forest green palette, Fraunces + Inter fonts)
- `postcss.config.js` - Tailwind + Autoprefixer
- `vercel.json` - Deployment config with SPA rewrite, OG crawler routing, cache headers
- `marketing/vercel.json` - Separate Vercel project for the marketing/landing site

## Platform Requirements

**Development:**
- Node.js 20+
- npm (lockfile present)
- Supabase CLI (for `supabase/` local dev)
- Xcode (for iOS builds) — macOS only
- Android Studio + JDK 21 (for Android builds)

**Production:**
- Web app: Vercel (`vercel.json`, framework: vite, output: `dist/`)
- iOS: Apple App Store — bundle ID `de.commsconnect.swingandsavor`, built via GitHub Actions (`ios-release.yml`) with TestFlight upload
- Android: Google Play Internal Track — built via GitHub Actions (`android-release.yml`) with AAB + Play upload
- Backend: Supabase (hosted Postgres + Edge Functions + Storage + Realtime)

---

*Stack analysis: 2026-06-14*
