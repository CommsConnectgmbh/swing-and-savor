# Swing & Savor — Landing-Redesign 2026-05-17

## Was geändert wurde
- **3 AI-generierte Bilder** über OpenAI `gpt-image-1` (high quality):
  - `hero.webp` — cinematic links-course at golden hour (1536×1024, 161 kB)
  - `detail-ball.webp` — golf ball backlit on tee, dewdrops (1024×1024, 41 kB)
  - `fairway.webp` — aerial top-down auf bunker-geometrie (1536×1024, 239 kB)
  - Generator-Script: `marketing/scripts/generate-images.mjs`
  - Optimierung: `cwebp -q 82` für WebP + `sips` JPG-Fallback
- **Landing komplett überarbeitet** auf editorial premium-feel:
  - Full-bleed Hero mit Image + Gradient + Fraunces serif („Wo jeder Schlag *zählt*.")
  - Sticky blur-nav mit scrolled-state
  - Bento-Feature-Grid mit Image-Card als Anker (1.745 Plätze)
  - Split-Section Copy ↔ Image (Match Play + detail-ball)
  - Process-Steps mit Fraunces italic counter
  - DealBuddy-Band mit Gold-Akzent
  - Final-CTA über Fairway-Image
  - Film-Grain-Overlay über SVG noise
  - `prefers-reduced-motion` respektiert
  - IntersectionObserver Reveal-Animationen

## Design-Entscheidungen
- **Fraunces** (variable serif italic) als Akzent neben Barlow Condensed → editorial feel, sticht aus dem üblichen SaaS-Sans-Look raus
- **Brand-Grün** nur für eine echte CTA-Hierarchie + Akzente, nicht überall
- **Gold** (`#e8b44a`) exklusiv für DealBuddy-Band — visuell von der Standard-Page abgesetzt
- **WebP-first** mit JPG-Fallback (`<picture>` und multiple-image `background-image`)
- **Cinematic Aspect Ratios**: Hero full-height, Split-Image 4:5 vertikal, Bento-Card landscape

## Performance
- Initial image payload: 441 kB WebP (≪ Lighthouse-Warnschwelle)
- Sticky nav nur 3 Werte (background + border)
- Reveal-Animations 1× pro Element (`io.unobserve` nach erstem Hit)
- Smooth-scroll nur HTML, kein Lib
- Bilder mit `loading="lazy"` außerhalb des Heros, Hero mit `preload`
- Schriften via `&display=swap`

## Live (Smoke-Test)
```
200  swingandsavor.at/        (HTML)
200  swingandsavor.at/impressum
200  swingandsavor.at/datenschutz
200  swingandsavor.at/agb
200  /img/hero.webp           161 kB
200  /img/detail-ball.webp     41 kB
200  /img/fairway.webp        239 kB
```

## Verifikation für Rainer
1. swingandsavor.at öffnen (am besten mit Hard-Reload).
2. Beim Scrollen:
   - Nav wird beim Scrollen dunkler/härter
   - Hero-Image bleibt vollformatig im Viewport
   - Bento-Grid hat eine große Image-Card mit Fairway-Hintergrund
   - Process-Section zeigt italic `01 / 02 / 03` als Counter
   - DealBuddy-Band ist gold-akzentuiert
   - Final-CTA hat das Fairway-Image als Hintergrund
3. Mobile (iPhone Safari) → Hero-Höhe nutzt `100svh`, Bento collapsed sauber.

## Tooling-Hinweis für später
Image-Generator-Script ist idempotent (skip wenn PNG existiert). Neue Bilder einfach in der `JOBS`-Array eintragen und `node marketing/scripts/generate-images.mjs` laufen lassen.
