-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Casual Rounds (Just-for-fun-Mode)                      │
-- │ Lockere Runden ohne Turnier-Kontext, ohne Team-A/B.                    │
-- │ 1–4 Spieler, jeder mit eigener Scorecard.                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists casual_rounds (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text,
  course_id       uuid references courses(id) on delete set null,
  course_name     text,
  hole_pars       int[] not null default '{}',
  hole_handicaps  int[] not null default '{}',
  status          text not null default 'active'
                    check (status in ('active','finished')),
  visibility      text not null default 'friends'
                    check (visibility in ('public','friends','private')),
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists casual_rounds_owner_idx on casual_rounds (owner_id);
create index if not exists casual_rounds_status_idx on casual_rounds (status);

create table if not exists casual_round_players (
  round_id     uuid not null references casual_rounds(id) on delete cascade,
  idx          int  not null check (idx between 1 and 4),
  profile_id   uuid references profiles(id) on delete set null,
  display_name text not null,
  handicap     numeric(4,1) not null default 0
                  check (handicap >= 0 and handicap <= 54),
  primary key (round_id, idx)
);

create index if not exists casual_round_players_profile_idx
  on casual_round_players (profile_id);

create table if not exists casual_scores (
  round_id    uuid not null references casual_rounds(id) on delete cascade,
  player_idx  int  not null check (player_idx between 1 and 4),
  hole_number int  not null check (hole_number between 1 and 18),
  strokes     int  not null check (strokes between 1 and 30),
  updated_at  timestamptz not null default now(),
  primary key (round_id, player_idx, hole_number)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table casual_rounds         enable row level security;
alter table casual_round_players  enable row level security;
alter table casual_scores         enable row level security;

-- Hilfsfunktion: sehe ich diese Runde?
create or replace function casual_round_visible(r casual_rounds, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    r.owner_id = uid
    or r.visibility = 'public'
    or (
      r.visibility = 'friends'
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (
            (f.user_a = r.owner_id and f.user_b = uid) or
            (f.user_b = r.owner_id and f.user_a = uid)
          )
      )
    )
    or exists (
      select 1 from casual_round_players p
      where p.round_id = r.id and p.profile_id = uid
    )
$$;

-- casual_rounds: Owner CRUD, Sichtbare nur lesen
drop policy if exists casual_rounds_select on casual_rounds;
create policy casual_rounds_select on casual_rounds for select
using (casual_round_visible(casual_rounds, auth.uid()));

drop policy if exists casual_rounds_insert on casual_rounds;
create policy casual_rounds_insert on casual_rounds for insert
with check (owner_id = auth.uid());

drop policy if exists casual_rounds_update on casual_rounds;
create policy casual_rounds_update on casual_rounds for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists casual_rounds_delete on casual_rounds;
create policy casual_rounds_delete on casual_rounds for delete
using (owner_id = auth.uid());

-- casual_round_players: gleiche Sichtbarkeit wie Runde
drop policy if exists casual_round_players_select on casual_round_players;
create policy casual_round_players_select on casual_round_players for select
using (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_round_players.round_id
      and casual_round_visible(r, auth.uid())
  )
);

drop policy if exists casual_round_players_write on casual_round_players;
create policy casual_round_players_write on casual_round_players for all
using (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_round_players.round_id
      and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_round_players.round_id
      and r.owner_id = auth.uid()
  )
);

-- casual_scores: Sichtbarkeit für Read; Owner ODER der Mitspieler-Account selbst darf schreiben
drop policy if exists casual_scores_select on casual_scores;
create policy casual_scores_select on casual_scores for select
using (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_scores.round_id
      and casual_round_visible(r, auth.uid())
  )
);

drop policy if exists casual_scores_write on casual_scores;
create policy casual_scores_write on casual_scores for all
using (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_scores.round_id
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from casual_round_players p
          where p.round_id = r.id
            and p.idx = casual_scores.player_idx
            and p.profile_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1 from casual_rounds r
    where r.id = casual_scores.round_id
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from casual_round_players p
          where p.round_id = r.id
            and p.idx = casual_scores.player_idx
            and p.profile_id = auth.uid()
        )
      )
  )
);

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'casual_scores'
  ) then
    alter publication supabase_realtime add table casual_scores;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'casual_rounds'
  ) then
    alter publication supabase_realtime add table casual_rounds;
  end if;
end $$;
