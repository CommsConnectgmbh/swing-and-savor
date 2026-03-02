# Golf Cup PWA — Design Document
Date: 2026-03-02

## Overview
A Progressive Web App for managing Ryder Cup-style golf tournaments. Teams compete via Match Play (singles + 2v2 doubles). Results are stored in Supabase and broadcast live to all viewers via WebSocket subscriptions. No login required — anyone with the link can enter results and watch the live scoreboard.

---

## Architecture

**Stack:** React + Vite + Tailwind CSS → Supabase (PostgreSQL + Realtime)

- Frontend: React PWA (installable, mobile-first)
- Database: Supabase (PostgreSQL)
- Realtime: Supabase Realtime WebSocket subscriptions
- Hosting: Netlify / Vercel / GitHub Pages (static)
- No backend server required — Supabase JS client runs in browser

---

## Visual Language

- **Style:** Tesla-inspired — deep black background (`#0a0a0a`), sharp white text, single accent color
- **Accent:** Golf Green (`#22c55e`) — high contrast, thematically appropriate
- **Typography:** Clean sans-serif, bold hierarchy
- **Mobile-first:** Bottom navigation bar, min 48px touch targets, card-based layouts
- **Dark theme only**

---

## Navigation

4 tabs in bottom navigation bar:

| Tab | Icon | Purpose |
|-----|------|---------|
| Cup | 🏆 | Tournament management (create, settings) |
| Matches | ⚔️ | All matches, enter results |
| Teams | 👥 | Manage players and handicaps |
| Board | 📊 | Live scoreboard (overview + detail) |

---

## Data Model (Supabase)

### `tournaments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Tournament name |
| date | date | |
| status | enum | `active` / `finished` |
| team_a_name | text | |
| team_b_name | text | |

### `players`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| name | text | |
| handicap | decimal(4,1) | Required, 0.0–54.0 |
| team | enum | `A` / `B` |

### `matches`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tournament_id | uuid | FK |
| type | enum | `singles` / `doubles` |
| team_a_player1_id | uuid | FK → players |
| team_a_player2_id | uuid | FK, nullable (singles) |
| team_b_player1_id | uuid | FK → players |
| team_b_player2_id | uuid | FK, nullable (singles) |
| status | enum | `pending` / `active` / `finished` |
| winner | enum | `A` / `B` / `halved` / null |

### `hole_results`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| match_id | uuid | FK → matches |
| hole_number | int | 1–18 |
| strokes_a | int | |
| strokes_b | int | |
| winner | enum | `A` / `B` / `halved` |
| stroke_advantage | enum | `A` / `B` / `none` — manual per-hole stroke grant |

---

## Screens

### Board (Live Scoreboard)
- Large team score display (e.g. 8.5 vs 7.5) — dominant, auto-updating
- Card per match showing: players, current hole, match standing (e.g. "3 UP", "ALL SQUARE", "2&1")
- Tap card → Detail view
- Supabase Realtime subscription updates without page reload

### Match Detail
- Table: Hole number | Strokes A | Strokes B | Stroke Advantage
- Running match score shown below table (e.g. "1 UP (Team A) after Hole 7")
- Button: "+ Loch eintragen" → opens input for next hole
- Finished matches show final result prominently

### Teams
- Player list per team showing: Name · HC · Team badge
- Add/edit player with HC validation (required, 0.0–54.0, decimal allowed)
- HC shown in list at all times

### Matches
- List of all matches with status indicator
- Create singles or doubles match, assign players
- Tap to open detail / enter results

### Cup
- Active tournament overview
- Create new tournament (name, date, team names)
- Tournament settings

---

## Key UX Rules

1. **Confirm dialog on all deletes:** "Wirklich löschen?" with red confirm button
2. **HC is mandatory:** No default value, must be explicitly entered (0.0–54.0)
3. **HC visible in player list** at all times
4. **Hole number always shown** in results tables
5. **Match Play scoring:** Hole won = +1, halved = no change, lost = -1 to lead
6. **No HC in scoring calculation** — raw strokes count
7. **Stroke advantage per hole** is optional and manual — just visual context, does not affect calculated winner
8. **Team points:** Win = 1.0pt, Halved = 0.5pt, Loss = 0pt

---

## Realtime Strategy

- Subscribe to `hole_results` and `matches` tables on Board and Match Detail screens
- On INSERT/UPDATE → re-calculate and re-render live stand
- No polling needed — pure WebSocket push

---

## PWA Requirements

- Installable on iOS, Android, Desktop
- Offline: show last-known state from cache (read-only offline, writes require connection)
- Icons: full set (72–512px)
- Standalone display mode
- Dark theme color in manifest
