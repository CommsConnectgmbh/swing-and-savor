-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  date date not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  team_a_name text not null default 'Team A',
  team_b_name text not null default 'Team B',
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  handicap decimal(4,1) not null check (handicap >= 0 and handicap <= 54),
  team text not null check (team in ('A', 'B')),
  created_at timestamptz default now()
);

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

alter table tournaments enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table hole_results enable row level security;

create policy "public_all" on tournaments for all using (true) with check (true);
create policy "public_all" on players for all using (true) with check (true);
create policy "public_all" on matches for all using (true) with check (true);
create policy "public_all" on hole_results for all using (true) with check (true);

alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table hole_results;
alter publication supabase_realtime add table tournaments;
