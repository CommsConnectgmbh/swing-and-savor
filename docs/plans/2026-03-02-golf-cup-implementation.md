# Golf Cup PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React PWA for Ryder Cup-style golf tournament management with live scoring via Supabase Realtime.

**Architecture:** React + Vite SPA with bottom navigation, reading/writing directly to Supabase PostgreSQL. Supabase Realtime WebSocket subscriptions push live score updates to all connected clients without polling. No backend server required.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, Supabase JS v2, Vite PWA Plugin, React Router v6, Vitest + React Testing Library

---

## File Structure

```
golf-cup-pwa/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   └── scoring.js
│   ├── components/
│   │   ├── BottomNav.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── LoadingSpinner.jsx
│   ├── screens/
│   │   ├── CupScreen.jsx
│   │   ├── TeamsScreen.jsx
│   │   ├── MatchesScreen.jsx
│   │   ├── MatchDetailScreen.jsx
│   │   └── BoardScreen.jsx
│   └── hooks/
│       └── useRealtime.js
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
├── public/
│   ├── manifest.json
│   └── icons/  (place 192px + 512px PNG icons here)
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Design Tokens (Tesla-style, Golf Green accent)

```js
// Use these everywhere — no improvising
colors: {
  bg:      '#0a0a0a',   // page background
  surface: '#141414',   // cards, inputs
  border:  '#2a2a2a',   // subtle borders
  text:    '#ffffff',   // primary text
  muted:   '#6b7280',   // secondary text
  accent:  '#22c55e',   // golf green — wins, CTA
  danger:  '#ef4444',   // delete, loss
  warn:    '#f59e0b',   // halved, pending
}
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`

**Step 1: Scaffold project**

```bash
cd C:/Users/RainerRoloff/Downloads/golf-cup-pwa
npm create vite@latest . -- --template react
npm install
```

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js react-router-dom
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npx tailwindcss init -p
```

**Step 3: Configure `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0a0a0a',
        surface: '#141414',
        border:  '#2a2a2a',
        accent:  '#22c55e',
        danger:  '#ef4444',
        warn:    '#f59e0b',
        muted:   '#6b7280',
      },
    },
  },
  plugins: [],
}
```

**Step 4: Configure `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Golf Cup',
        short_name: 'Golf Cup',
        description: 'Ryder Cup Turnier Manager',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
})
```

**Step 5: Create `src/test-setup.js`**

```js
import '@testing-library/jest-dom'
```

**Step 6: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

**Step 7: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { -webkit-tap-highlight-color: transparent; }

body {
  background-color: #0a0a0a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overscroll-behavior: none;
}

/* Safe area for bottom nav */
.pb-safe {
  padding-bottom: calc(4rem + env(safe-area-inset-bottom));
}
```

**Step 8: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite dev server running at http://localhost:5173

**Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold React + Vite + Tailwind + Supabase + PWA"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/001_initial.sql`

**Step 1: Create the SQL migration**

```sql
-- supabase/migrations/001_initial.sql
-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- Tournaments
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  date date not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  team_a_name text not null default 'Team A',
  team_b_name text not null default 'Team B',
  created_at timestamptz default now()
);

-- Players
create table players (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  handicap decimal(4,1) not null check (handicap >= 0 and handicap <= 54),
  team text not null check (team in ('A', 'B')),
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  type text not null check (type in ('singles', 'doubles')),
  team_a_player1_id uuid references players(id),
  team_a_player2_id uuid references players(id),
  team_b_player1_id uuid references players(id),
  team_b_player2_id uuid references players(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'finished')),
  winner text check (winner in ('A', 'B', 'halved')),
  created_at timestamptz default now()
);

-- Hole results
create table hole_results (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references matches(id) on delete cascade,
  hole_number int not null check (hole_number >= 1 and hole_number <= 18),
  strokes_a int not null check (strokes_a >= 1),
  strokes_b int not null check (strokes_b >= 1),
  winner text not null check (winner in ('A', 'B', 'halved')),
  stroke_advantage text not null default 'none' check (stroke_advantage in ('A', 'B', 'none')),
  created_at timestamptz default now(),
  unique(match_id, hole_number)
);

-- Enable Row Level Security (allow all since no auth)
alter table tournaments enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table hole_results enable row level security;

create policy "public_all" on tournaments for all using (true) with check (true);
create policy "public_all" on players for all using (true) with check (true);
create policy "public_all" on matches for all using (true) with check (true);
create policy "public_all" on hole_results for all using (true) with check (true);

-- Enable Realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table hole_results;
alter publication supabase_realtime add table tournaments;
```

**Step 2: Run in Supabase SQL Editor**

Go to your Supabase project → SQL Editor → paste and run the above SQL.
Expected: All tables created without errors.

**Step 3: Get credentials**

In Supabase: Settings → API → copy `Project URL` and `anon public` key.

**Step 4: Create `.env.local`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 5: Add `.env.local` to `.gitignore`**

```
node_modules
dist
.env.local
```

**Step 6: Commit migration**

```bash
git add supabase/ .gitignore
git commit -m "feat: add Supabase schema migration"
```

---

## Task 3: Supabase Client + Scoring Logic

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/lib/scoring.js`
- Create: `src/lib/scoring.test.js`

**Step 1: Write failing tests for scoring logic**

```js
// src/lib/scoring.test.js
import { describe, it, expect } from 'vitest'
import { calcMatchStanding, calcTeamPoints } from './scoring'

describe('calcMatchStanding', () => {
  it('returns all square with no holes', () => {
    expect(calcMatchStanding([])).toEqual({ holesUp: 0, leader: 'none', holesPlayed: 0 })
  })

  it('tracks A winning a hole', () => {
    const holes = [{ winner: 'A' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'A', holesPlayed: 1 })
  })

  it('tracks B winning a hole', () => {
    const holes = [{ winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'B', holesPlayed: 1 })
  })

  it('halved hole does not change standing', () => {
    const holes = [{ winner: 'A' }, { winner: 'halved' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'A', holesPlayed: 2 })
  })

  it('lead changes when opponent wins more', () => {
    const holes = [{ winner: 'A' }, { winner: 'B' }, { winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'B', holesPlayed: 3 })
  })

  it('returns all square when tied', () => {
    const holes = [{ winner: 'A' }, { winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 0, leader: 'none', holesPlayed: 2 })
  })
})

describe('calcMatchStanding label', () => {
  it('formats label correctly', () => {
    const { label } = calcMatchStanding([{ winner: 'A' }, { winner: 'A' }])
    expect(label).toBe('2 UP')
  })

  it('formats all square', () => {
    const { label } = calcMatchStanding([])
    expect(label).toBe('ALL SQ')
  })
})

describe('calcTeamPoints', () => {
  it('counts wins as 1 point', () => {
    const matches = [{ winner: 'A', status: 'finished' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 1, B: 0 })
  })

  it('counts halved as 0.5 each', () => {
    const matches = [{ winner: 'halved', status: 'finished' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 0.5, B: 0.5 })
  })

  it('ignores unfinished matches', () => {
    const matches = [{ winner: null, status: 'active' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 0, B: 0 })
  })
})
```

**Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/scoring.test.js
```
Expected: FAIL — `scoring.js` not found

**Step 3: Implement `src/lib/scoring.js`**

```js
export function calcMatchStanding(holeResults) {
  let scoreA = 0
  let scoreB = 0

  for (const hole of holeResults) {
    if (hole.winner === 'A') scoreA++
    else if (hole.winner === 'B') scoreB++
  }

  const diff = scoreA - scoreB
  const holesUp = Math.abs(diff)
  const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : 'none'
  const label = leader === 'none' ? 'ALL SQ' : `${holesUp} UP`

  return { holesUp, leader, label, holesPlayed: holeResults.length }
}

export function calcTeamPoints(matches) {
  let A = 0
  let B = 0

  for (const match of matches) {
    if (match.status !== 'finished') continue
    if (match.winner === 'A') A += 1
    else if (match.winner === 'B') B += 1
    else if (match.winner === 'halved') { A += 0.5; B += 0.5 }
  }

  return { A, B }
}
```

**Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/scoring.test.js
```
Expected: All 9 tests PASS

**Step 5: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 6: Commit**

```bash
git add src/lib/
git commit -m "feat: add Supabase client and scoring logic with tests"
```

---

## Task 4: App Shell + Navigation

**Files:**
- Create: `src/App.jsx`
- Create: `src/components/BottomNav.jsx`
- Create: `src/components/LoadingSpinner.jsx`
- Create: `src/components/ConfirmDialog.jsx`

**Step 1: Create `src/components/BottomNav.jsx`**

```jsx
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/cup',     icon: '🏆', label: 'Cup'     },
  { to: '/matches', icon: '⚔️',  label: 'Matches' },
  { to: '/teams',   icon: '👥', label: 'Teams'   },
  { to: '/board',   icon: '📊', label: 'Board'   },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs transition-colors ` +
              (isActive ? 'text-accent' : 'text-muted')
            }
          >
            <span className="text-xl mb-0.5">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

**Step 2: Create `src/components/ConfirmDialog.jsx`**

```jsx
export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
        <p className="text-white text-lg font-medium mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border text-muted text-sm font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-danger text-white text-sm font-bold"
          >
            Wirklich löschen
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Create `src/components/LoadingSpinner.jsx`**

```jsx
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}
```

**Step 4: Create `src/App.jsx`**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import CupScreen from './screens/CupScreen'
import MatchesScreen from './screens/MatchesScreen'
import MatchDetailScreen from './screens/MatchDetailScreen'
import TeamsScreen from './screens/TeamsScreen'
import BoardScreen from './screens/BoardScreen'

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <main className="pb-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/cup" element={<CupScreen />} />
          <Route path="/matches" element={<MatchesScreen />} />
          <Route path="/matches/:matchId" element={<MatchDetailScreen />} />
          <Route path="/teams" element={<TeamsScreen />} />
          <Route path="/board" element={<BoardScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
```

**Step 5: Create placeholder screens (so app compiles)**

Create each file with a minimal placeholder:

`src/screens/CupScreen.jsx`:
```jsx
export default function CupScreen() { return <div className="p-4 text-white">Cup</div> }
```

Repeat for `MatchesScreen.jsx`, `MatchDetailScreen.jsx`, `TeamsScreen.jsx`, `BoardScreen.jsx`.

**Step 6: Verify app renders with tabs**

```bash
npm run dev
```
Expected: Black screen, bottom nav with 4 tabs, clicking tabs navigates between routes.

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: app shell with bottom navigation and routing"
```

---

## Task 5: Cup Screen (Tournament Management)

**Files:**
- Modify: `src/screens/CupScreen.jsx`

**Step 1: Implement CupScreen**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function CupScreen() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState({ name: '', date: '', team_a_name: 'Team A', team_b_name: 'Team B' })

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.date) return
    await supabase.from('tournaments').insert([form])
    setForm({ name: '', date: '', team_a_name: 'Team A', team_b_name: 'Team B' })
    setShowForm(false)
    loadTournaments()
  }

  async function handleDelete() {
    await supabase.from('tournaments').delete().eq('id', deleteId)
    setDeleteId(null)
    loadTournaments()
  }

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'finished' : 'active'
    await supabase.from('tournaments').update({ status: next }).eq('id', t.id)
    loadTournaments()
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-2xl font-bold">Turniere</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm"
        >
          + Neu
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <input
            className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Turniername *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            type="date"
            className="bg-bg border border-border rounded-xl px-4 py-3 text-white"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            required
          />
          <input
            className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Team A Name"
            value={form.team_a_name}
            onChange={e => setForm(f => ({ ...f, team_a_name: e.target.value }))}
          />
          <input
            className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Team B Name"
            value={form.team_b_name}
            onChange={e => setForm(f => ({ ...f, team_b_name: e.target.value }))}
          />
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">
            Turnier erstellen
          </button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col gap-3">
          {tournaments.map(t => (
            <div key={t.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg">{t.name}</div>
                  <div className="text-muted text-sm">{new Date(t.date).toLocaleDateString('de-DE')}</div>
                  <div className="text-sm mt-1">{t.team_a_name} vs {t.team_b_name}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => toggleStatus(t)}
                    className={`text-xs px-3 py-1 rounded-full font-medium ` +
                      (t.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted')}
                  >
                    {t.status === 'active' ? 'Aktiv' : 'Beendet'}
                  </button>
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="text-danger text-xs px-3 py-1 rounded-full border border-danger/30"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
          {tournaments.length === 0 && (
            <p className="text-muted text-center py-8">Noch keine Turniere. Erstelle dein erstes!</p>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Turnier wirklich löschen? Alle Matches und Ergebnisse werden ebenfalls gelöscht."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify in browser**
- Create a tournament
- Toggle active/finished
- Delete with confirm dialog

**Step 3: Commit**

```bash
git add src/screens/CupScreen.jsx
git commit -m "feat: Cup screen — tournament management"
```

---

## Task 6: Teams Screen (Player Management + HC)

**Files:**
- Modify: `src/screens/TeamsScreen.jsx`

**Step 1: Implement TeamsScreen**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

function validateHC(val) {
  const n = parseFloat(val)
  if (val === '' || val === null || val === undefined) return 'Handicap ist Pflicht'
  if (isNaN(n)) return 'Muss eine Zahl sein'
  if (n < 0 || n > 54) return 'Handicap muss zwischen 0.0 und 54.0 liegen'
  return null
}

export default function TeamsScreen() {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [hcError, setHcError] = useState(null)
  const [form, setForm] = useState({ name: '', handicap: '', team: 'A' })

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || [])
        if (data && data.length > 0) setSelectedTournament(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedTournament) loadPlayers()
  }, [selectedTournament])

  async function loadPlayers() {
    const { data } = await supabase.from('players')
      .select('*')
      .eq('tournament_id', selectedTournament.id)
      .order('team').order('name')
    setPlayers(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    const err = validateHC(form.handicap)
    if (err) { setHcError(err); return }
    await supabase.from('players').insert([{
      ...form,
      handicap: parseFloat(form.handicap),
      tournament_id: selectedTournament.id,
    }])
    setForm({ name: '', handicap: '', team: 'A' })
    setShowForm(false)
    setHcError(null)
    loadPlayers()
  }

  async function handleDelete() {
    await supabase.from('players').delete().eq('id', deleteId)
    setDeleteId(null)
    loadPlayers()
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-4">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm"
          disabled={!selectedTournament}
        >
          + Spieler
        </button>
      </div>

      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <select
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white mb-4"
          value={selectedTournament?.id || ''}
          onChange={e => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}
        >
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <input
            className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <div>
            <input
              type="number"
              step="0.1"
              min="0"
              max="54"
              className={`w-full bg-bg border rounded-xl px-4 py-3 text-white placeholder-muted ` +
                (hcError ? 'border-danger' : 'border-border')}
              placeholder="Handicap * (0.0 – 54.0)"
              value={form.handicap}
              onChange={e => { setForm(f => ({ ...f, handicap: e.target.value })); setHcError(null) }}
            />
            {hcError && <p className="text-danger text-xs mt-1 pl-1">{hcError}</p>}
          </div>
          <div className="flex gap-2">
            {['A', 'B'].map(team => (
              <button
                key={team}
                type="button"
                onClick={() => setForm(f => ({ ...f, team }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ` +
                  (form.team === team ? 'bg-accent text-black' : 'bg-bg border border-border text-muted')}
              >
                {selectedTournament ? (team === 'A' ? selectedTournament.team_a_name : selectedTournament.team_b_name) : `Team ${team}`}
              </button>
            ))}
          </div>
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">
            Spieler hinzufügen
          </button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <>
          {[['A', teamA], ['B', teamB]].map(([team, list]) => (
            <div key={team} className="mb-4">
              <h2 className="text-accent font-bold text-sm uppercase tracking-widest mb-2">
                {team === 'A' ? selectedTournament?.team_a_name : selectedTournament?.team_b_name} · {list.length} Spieler
              </h2>
              <div className="flex flex-col gap-2">
                {list.map(p => (
                  <div key={p.id} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted text-sm ml-2">HC {p.handicap.toFixed(1)}</span>
                    </div>
                    <button onClick={() => setDeleteId(p.id)} className="text-danger text-sm px-2 py-1">✕</button>
                  </div>
                ))}
                {list.length === 0 && <p className="text-muted text-sm pl-1">Keine Spieler</p>}
              </div>
            </div>
          ))}
        </>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Spieler wirklich löschen?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify HC validation**
- Try submitting with empty HC → error shown
- Try HC = 100 → error shown
- Try HC = 54.0 → accepted
- HC displayed in player list as "HC 12.4"

**Step 3: Commit**

```bash
git add src/screens/TeamsScreen.jsx
git commit -m "feat: Teams screen with HC validation and player list"
```

---

## Task 7: Matches Screen (Match Management)

**Files:**
- Modify: `src/screens/MatchesScreen.jsx`

**Step 1: Implement MatchesScreen**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MatchesScreen() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected] = useState(null)
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState({ type: 'singles', a1: '', a2: '', b1: '', b2: '' })

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || [])
        if (data?.length > 0) setSelected(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selected) { loadMatches(); loadPlayers() }
  }, [selected])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select(`
      *,
      pa1:team_a_player1_id(name),
      pa2:team_a_player2_id(name),
      pb1:team_b_player1_id(name),
      pb2:team_b_player2_id(name)
    `).eq('tournament_id', selected.id).order('created_at')
    setMatches(data || [])
  }

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').eq('tournament_id', selected.id).order('team').order('name')
    setPlayers(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    const payload = {
      tournament_id: selected.id,
      type: form.type,
      team_a_player1_id: form.a1 || null,
      team_a_player2_id: form.type === 'doubles' ? (form.a2 || null) : null,
      team_b_player1_id: form.b1 || null,
      team_b_player2_id: form.type === 'doubles' ? (form.b2 || null) : null,
    }
    await supabase.from('matches').insert([payload])
    setForm({ type: 'singles', a1: '', a2: '', b1: '', b2: '' })
    setShowForm(false)
    loadMatches()
  }

  async function handleDelete() {
    await supabase.from('matches').delete().eq('id', deleteId)
    setDeleteId(null)
    loadMatches()
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  function matchLabel(m) {
    const a = [m.pa1?.name, m.pa2?.name].filter(Boolean).join(' / ')
    const b = [m.pb1?.name, m.pb2?.name].filter(Boolean).join(' / ')
    return `${a || '—'} vs ${b || '—'}`
  }

  const statusColor = { pending: 'text-muted', active: 'text-warn', finished: 'text-accent' }
  const statusLabel = { pending: 'Ausstehend', active: 'Läuft', finished: 'Beendet' }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-4">
        <h1 className="text-2xl font-bold">Matches</h1>
        <button onClick={() => setShowForm(v => !v)} className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm" disabled={!selected}>
          + Match
        </button>
      </div>

      {tournaments.length > 1 && (
        <select className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white mb-4"
          value={selected?.id || ''}
          onChange={e => setSelected(tournaments.find(t => t.id === e.target.value))}>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {['singles', 'doubles'].map(type => (
              <button key={type} type="button"
                onClick={() => setForm(f => ({ ...f, type }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm ` +
                  (form.type === type ? 'bg-accent text-black' : 'bg-bg border border-border text-muted')}>
                {type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs uppercase tracking-widest">{selected?.team_a_name}</p>
          <PlayerSelect label="Spieler A1" value={form.a1} options={teamA} onChange={v => setForm(f => ({ ...f, a1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label="Spieler A2" value={form.a2} options={teamA} onChange={v => setForm(f => ({ ...f, a2: v }))} />
          )}
          <p className="text-muted text-xs uppercase tracking-widest">{selected?.team_b_name}</p>
          <PlayerSelect label="Spieler B1" value={form.b1} options={teamB} onChange={v => setForm(f => ({ ...f, b1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label="Spieler B2" value={form.b2} options={teamB} onChange={v => setForm(f => ({ ...f, b2: v }))} />
          )}
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">Match anlegen</button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col gap-3">
          {matches.map(m => (
            <div key={m.id} className="bg-surface border border-border rounded-2xl p-4 active:opacity-80"
              onClick={() => navigate(`/matches/${m.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-muted mb-1">{m.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</div>
                  <div className="font-medium text-sm">{matchLabel(m)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-medium ${statusColor[m.status]}`}>{statusLabel[m.status]}</span>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(m.id) }} className="text-danger text-xs px-2 py-1">✕</button>
                </div>
              </div>
            </div>
          ))}
          {matches.length === 0 && <p className="text-muted text-center py-8">Noch keine Matches angelegt.</p>}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Match wirklich löschen? Alle eingetragenen Ergebnisse gehen verloren."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function PlayerSelect({ label, value, options, onChange }) {
  return (
    <select className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white"
      value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{label} wählen…</option>
      {options.map(p => (
        <option key={p.id} value={p.id}>{p.name} (HC {p.handicap.toFixed(1)})</option>
      ))}
    </select>
  )
}
```

**Step 2: Verify**
- Create singles and doubles matches
- Tap match → navigates to detail (placeholder for now)
- Delete with confirm

**Step 3: Commit**

```bash
git add src/screens/MatchesScreen.jsx
git commit -m "feat: Matches screen — match creation and listing"
```

---

## Task 8: Match Detail Screen (Hole-by-Hole Entry)

**Files:**
- Modify: `src/screens/MatchDetailScreen.jsx`

**Step 1: Implement MatchDetailScreen**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcMatchStanding } from '../lib/scoring'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MatchDetailScreen() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [holeResults, setHoleResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHoleForm, setShowHoleForm] = useState(false)
  const [deleteHoleId, setDeleteHoleId] = useState(null)
  const [holeForm, setHoleForm] = useState({ strokes_a: '', strokes_b: '', stroke_advantage: 'none' })

  useEffect(() => { loadAll() }, [matchId])

  async function loadAll() {
    const [{ data: m }, { data: h }] = await Promise.all([
      supabase.from('matches').select(`
        *,
        pa1:team_a_player1_id(name, handicap),
        pa2:team_a_player2_id(name, handicap),
        pb1:team_b_player1_id(name, handicap),
        pb2:team_b_player2_id(name, handicap),
        tournament:tournament_id(team_a_name, team_b_name)
      `).eq('id', matchId).single(),
      supabase.from('hole_results').select('*').eq('match_id', matchId).order('hole_number'),
    ])
    setMatch(m)
    setHoleResults(h || [])
    setLoading(false)
  }

  const nextHole = holeResults.length + 1
  const standing = calcMatchStanding(holeResults)
  const canAddHole = nextHole <= 18 && match?.status !== 'finished'

  async function handleAddHole(e) {
    e.preventDefault()
    const sa = parseInt(holeForm.strokes_a)
    const sb = parseInt(holeForm.strokes_b)
    if (!sa || !sb || sa < 1 || sb < 1) return
    const winner = sa < sb ? 'A' : sb < sa ? 'B' : 'halved'
    await supabase.from('hole_results').insert([{
      match_id: matchId,
      hole_number: nextHole,
      strokes_a: sa,
      strokes_b: sb,
      winner,
      stroke_advantage: holeForm.stroke_advantage,
    }])
    await supabase.from('matches').update({ status: 'active' }).eq('id', matchId)
    setHoleForm({ strokes_a: '', strokes_b: '', stroke_advantage: 'none' })
    setShowHoleForm(false)
    loadAll()
  }

  async function handleFinishMatch() {
    const winner = standing.leader !== 'none' ? standing.leader : 'halved'
    await supabase.from('matches').update({ status: 'finished', winner }).eq('id', matchId)
    loadAll()
  }

  async function handleDeleteHole() {
    await supabase.from('hole_results').delete().eq('id', deleteHoleId)
    // Recalculate match status
    await supabase.from('matches').update({ status: holeResults.length <= 1 ? 'pending' : 'active', winner: null }).eq('id', matchId)
    setDeleteHoleId(null)
    loadAll()
  }

  if (loading) return <div className="p-4 pt-8"><LoadingSpinner /></div>
  if (!match) return <div className="p-4 pt-8 text-muted">Match nicht gefunden</div>

  const teamA = [match.pa1?.name, match.pa2?.name].filter(Boolean).join(' / ')
  const teamB = [match.pb1?.name, match.pb2?.name].filter(Boolean).join(' / ')
  const tA = match.tournament?.team_a_name
  const tB = match.tournament?.team_b_name

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-muted text-2xl leading-none">‹</button>
        <div>
          <div className="text-xs text-muted">{match.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</div>
          <div className="font-bold">{teamA} vs {teamB}</div>
        </div>
      </div>

      {/* Standing */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6 text-center">
        <div className={`text-4xl font-black mb-1 ` +
          (standing.leader === 'A' ? 'text-accent' : standing.leader === 'B' ? 'text-danger' : 'text-white')}>
          {standing.label}
        </div>
        {standing.leader !== 'none' && (
          <div className="text-muted text-sm">{standing.leader === 'A' ? tA : tB} führt</div>
        )}
        <div className="text-muted text-xs mt-1">
          {holeResults.length === 0 ? 'Noch kein Loch gespielt' : `Nach Loch ${holeResults.length}`}
        </div>
        {match.status === 'finished' && (
          <div className="mt-2 text-accent font-bold text-sm">MATCH BEENDET</div>
        )}
      </div>

      {/* Hole table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-5 text-xs text-muted uppercase tracking-widest px-4 py-2 border-b border-border">
          <span>Loch</span>
          <span className="text-center">{tA?.substring(0, 6)}</span>
          <span className="text-center">{tB?.substring(0, 6)}</span>
          <span className="text-center">Vorg.</span>
          <span className="text-center">Erg.</span>
        </div>
        {holeResults.map(h => (
          <div key={h.id}
            className="grid grid-cols-5 px-4 py-3 border-b border-border last:border-0 items-center"
            onClick={() => setDeleteHoleId(h.id)}>
            <span className="font-mono font-bold text-accent">{h.hole_number}</span>
            <span className={`text-center font-mono ` + (h.winner === 'A' ? 'text-accent font-bold' : 'text-white')}>{h.strokes_a}</span>
            <span className={`text-center font-mono ` + (h.winner === 'B' ? 'text-danger font-bold' : 'text-white')}>{h.strokes_b}</span>
            <span className="text-center text-xs text-muted">
              {h.stroke_advantage === 'none' ? '—' : h.stroke_advantage}
            </span>
            <span className={`text-center text-xs font-medium ` +
              (h.winner === 'A' ? 'text-accent' : h.winner === 'B' ? 'text-danger' : 'text-muted')}>
              {h.winner === 'A' ? 'A' : h.winner === 'B' ? 'B' : '½'}
            </span>
          </div>
        ))}
        {holeResults.length === 0 && (
          <div className="text-muted text-sm text-center py-6">Noch keine Löcher eingetragen</div>
        )}
      </div>
      {holeResults.length > 0 && <p className="text-muted text-xs text-center mb-4">Loch antippen zum Löschen</p>}

      {/* Add hole form */}
      {canAddHole && (
        <>
          {showHoleForm ? (
            <form onSubmit={handleAddHole} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <div className="text-sm font-medium text-accent">Loch {nextHole}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">{tA} – Schläge</label>
                  <input type="number" min="1" max="20"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
                    placeholder="—"
                    value={holeForm.strokes_a}
                    onChange={e => setHoleForm(f => ({ ...f, strokes_a: e.target.value }))}
                    required />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">{tB} – Schläge</label>
                  <input type="number" min="1" max="20"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
                    placeholder="—"
                    value={holeForm.strokes_b}
                    onChange={e => setHoleForm(f => ({ ...f, strokes_b: e.target.value }))}
                    required />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Schlag-Vorgabe (optional)</label>
                <select className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white"
                  value={holeForm.stroke_advantage}
                  onChange={e => setHoleForm(f => ({ ...f, stroke_advantage: e.target.value }))}>
                  <option value="none">Keine Vorgabe</option>
                  <option value="A">{tA} bekommt Vorgabe</option>
                  <option value="B">{tB} bekommt Vorgabe</option>
                </select>
              </div>
              <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">
                Loch {nextHole} speichern
              </button>
              <button type="button" onClick={() => setShowHoleForm(false)}
                className="text-muted text-sm text-center py-1">Abbrechen</button>
            </form>
          ) : (
            <button onClick={() => setShowHoleForm(true)}
              className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-lg mb-3">
              + Loch {nextHole} eintragen
            </button>
          )}
        </>
      )}

      {/* Finish match */}
      {holeResults.length > 0 && match.status === 'active' && (
        <button onClick={handleFinishMatch}
          className="w-full border border-accent text-accent font-bold py-4 rounded-2xl text-lg">
          Match beenden
        </button>
      )}

      {deleteHoleId && (
        <ConfirmDialog
          message="Loch-Ergebnis wirklich löschen?"
          onConfirm={handleDeleteHole}
          onCancel={() => setDeleteHoleId(null)}
        />
      )}
    </div>
  )
}
```

**Step 2: Verify**
- Enter holes 1–3, check standing updates
- Hole numbers visible in table
- Delete a hole with confirm dialog
- Stroke advantage visible in table

**Step 3: Commit**

```bash
git add src/screens/MatchDetailScreen.jsx
git commit -m "feat: Match detail screen with hole-by-hole entry and standing"
```

---

## Task 9: Board Screen (Live Scoreboard + Realtime)

**Files:**
- Modify: `src/screens/BoardScreen.jsx`

**Step 1: Implement BoardScreen with Supabase Realtime**

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcTeamPoints, calcMatchStanding } from '../lib/scoring'
import LoadingSpinner from '../components/LoadingSpinner'

export default function BoardScreen() {
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [holesByMatch, setHolesByMatch] = useState({})
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    loadData()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function loadData() {
    // Get active tournament
    const { data: t } = await supabase.from('tournaments')
      .select('*').eq('status', 'active').order('date', { ascending: false }).limit(1).single()

    if (!t) { setLoading(false); return }
    setTournament(t)

    // Load matches with player names
    const { data: m } = await supabase.from('matches').select(`
      *,
      pa1:team_a_player1_id(name),
      pa2:team_a_player2_id(name),
      pb1:team_b_player1_id(name),
      pb2:team_b_player2_id(name)
    `).eq('tournament_id', t.id).order('created_at')

    if (!m) { setLoading(false); return }
    setMatches(m)

    // Load all hole results for these matches
    const matchIds = m.map(x => x.id)
    if (matchIds.length > 0) {
      const { data: holes } = await supabase.from('hole_results')
        .select('*').in('match_id', matchIds).order('hole_number')
      const byMatch = {}
      for (const h of (holes || [])) {
        if (!byMatch[h.match_id]) byMatch[h.match_id] = []
        byMatch[h.match_id].push(h)
      }
      setHolesByMatch(byMatch)
    }

    setLoading(false)
    subscribeRealtime(t.id)
  }

  function subscribeRealtime(tournamentId) {
    const channel = supabase.channel(`board-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_results' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
      .subscribe()
    channelRef.current = channel
  }

  if (loading) return <div className="p-4 pt-8"><LoadingSpinner /></div>

  if (!tournament) return (
    <div className="p-4 pt-8 text-center">
      <div className="text-6xl mb-4">🏆</div>
      <p className="text-muted">Kein aktives Turnier. Erstelle eines unter Cup.</p>
    </div>
  )

  const points = calcTeamPoints(matches)
  const totalPossible = matches.length

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Tournament header */}
      <div className="pt-6 pb-4 text-center">
        <div className="text-muted text-xs uppercase tracking-widest mb-1">{new Date(tournament.date).toLocaleDateString('de-DE')}</div>
        <h1 className="text-xl font-bold">{tournament.name}</h1>
      </div>

      {/* Team score - dominant display */}
      <div className="bg-surface border border-border rounded-3xl p-6 mb-6">
        <div className="grid grid-cols-3 items-center">
          <div className="text-center">
            <div className="text-muted text-xs uppercase tracking-widest mb-2 truncate">{tournament.team_a_name}</div>
            <div className="text-6xl font-black text-accent">{points.A % 1 === 0 ? points.A : points.A.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-muted text-2xl">vs</div>
            <div className="text-muted text-xs mt-1">{totalPossible} Matches</div>
          </div>
          <div className="text-center">
            <div className="text-muted text-xs uppercase tracking-widest mb-2 truncate">{tournament.team_b_name}</div>
            <div className="text-6xl font-black text-white">{points.B % 1 === 0 ? points.B : points.B.toFixed(1)}</div>
          </div>
        </div>

        {/* Progress bar */}
        {totalPossible > 0 && (
          <div className="mt-4 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(points.A / totalPossible) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Match cards */}
      <div className="flex flex-col gap-3">
        {matches.map(m => {
          const holes = holesByMatch[m.id] || []
          const standing = calcMatchStanding(holes)
          const teamA = [m.pa1?.name, m.pa2?.name].filter(Boolean).join(' / ')
          const teamB = [m.pb1?.name, m.pb2?.name].filter(Boolean).join(' / ')
          const standingColor = m.status === 'finished'
            ? (m.winner === 'A' ? 'text-accent' : m.winner === 'B' ? 'text-danger' : 'text-warn')
            : (standing.leader === 'A' ? 'text-accent' : standing.leader === 'B' ? 'text-danger' : 'text-white')

          return (
            <div key={m.id}
              className="bg-surface border border-border rounded-2xl p-4 active:opacity-70"
              onClick={() => navigate(`/matches/${m.id}`)}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-muted">{m.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</span>
                <span className={`text-xs font-medium ` + (m.status === 'finished' ? 'text-accent' : m.status === 'active' ? 'text-warn' : 'text-muted')}>
                  {m.status === 'finished' ? 'Beendet' : m.status === 'active' ? `Loch ${holes.length}` : 'Ausstehend'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{teamA || '—'}</div>
                  <div className="text-xs text-muted mt-0.5 truncate">{teamB || '—'}</div>
                </div>
                <div className={`text-2xl font-black ml-4 ` + standingColor}>
                  {m.status === 'finished'
                    ? (m.winner === 'halved' ? '½' : standing.label)
                    : (holes.length > 0 ? standing.label : '—')}
                </div>
              </div>
            </div>
          )
        })}
        {matches.length === 0 && <p className="text-muted text-center py-8">Noch keine Matches angelegt.</p>}
      </div>
    </div>
  )
}
```

**Step 2: Verify Realtime**
- Open Board on two browsers/tabs
- Enter a hole result in Match Detail on one tab
- Board on other tab should update automatically within ~1 second

**Step 3: Commit**

```bash
git add src/screens/BoardScreen.jsx
git commit -m "feat: Board screen with live Supabase Realtime subscriptions"
```

---

## Task 10: PWA Icons + Final Polish

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`

**Step 1: Add icons**

Place a 192×192px and 512×512px PNG golf icon in `public/icons/`. You can use any golf/trophy icon. A simple placeholder:

```bash
# If you have ImageMagick:
convert -size 192x192 xc:'#0a0a0a' -fill '#22c55e' -font Arial -pointsize 100 -gravity center -annotate 0 "⛳" public/icons/icon-192.png
convert -size 512x512 xc:'#0a0a0a' -fill '#22c55e' -font Arial -pointsize 260 -gravity center -annotate 0 "⛳" public/icons/icon-512.png
```

Or use any PNG image editor to create simple icons.

**Step 2: Update `index.html` with meta tags**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Golf Cup" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>Golf Cup</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 3: Build and verify**

```bash
npm run build
```
Expected: `dist/` folder created without errors.

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: PWA icons and final meta tags — app complete"
```

---

## Task 11: Deploy to Netlify/Vercel

**Step 1: Deploy**

Option A — Netlify Drop: Go to netlify.com/drop, drag the `dist/` folder.

Option B — Vercel CLI:
```bash
npx vercel --prod
```
Set environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting dashboard.

**Step 2: Set env vars in hosting dashboard**

In Netlify/Vercel → Settings → Environment Variables:
- `VITE_SUPABASE_URL` = your Supabase URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

Then re-deploy.

**Step 3: Test on mobile**
- Open URL on iPhone/Android
- Add to Home Screen
- Verify: dark theme, bottom nav, live updates work

---

## Summary

| Task | Component | Key Detail |
|------|-----------|------------|
| 1 | Project Setup | Vite + React + Tailwind + Supabase + PWA |
| 2 | Supabase Schema | 4 tables, RLS public, Realtime enabled |
| 3 | Scoring Logic | Tests first — `calcMatchStanding`, `calcTeamPoints` |
| 4 | App Shell | Bottom nav, dark theme, routing |
| 5 | Cup Screen | Tournament CRUD + confirm delete |
| 6 | Teams Screen | Player list with HC, validation 0–54, confirm delete |
| 7 | Matches Screen | Singles + doubles match creation |
| 8 | Match Detail | Hole entry, hole numbers, stroke advantage, confirm delete |
| 9 | Board Screen | Live Supabase Realtime, team points, match cards |
| 10 | PWA Polish | Icons, meta tags, build |
| 11 | Deploy | Netlify/Vercel, env vars |
