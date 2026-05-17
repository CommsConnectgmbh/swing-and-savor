-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Social Layer Migration                                  │
-- │ Adds: profiles, friendships, tournament-visibility, invites             │
-- │ Apply once via Supabase SQL Editor (project: atusckkhihgndfxtufsx)      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null,
  avatar_url    text,
  home_club     text,
  hcp           numeric(4,1) check (hcp >= 0 and hcp <= 54),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists profiles_handle_idx on profiles (lower(handle));

-- ── friendships (bidirectional, canonical-ordered) ───────────────────────────
create table if not exists friendships (
  user_a       uuid not null references profiles(id) on delete cascade,
  user_b       uuid not null references profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  requested_by uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  responded_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_a_idx on friendships (user_a);
create index if not exists friendships_user_b_idx on friendships (user_b);

-- ── tournaments: add owner, visibility, invite_code ──────────────────────────
alter table tournaments
  add column if not exists owner_id    uuid references profiles(id) on delete set null,
  add column if not exists visibility  text not null default 'public'
    check (visibility in ('public','friends','private')),
  add column if not exists invite_code text unique,
  add column if not exists description text;

create index if not exists tournaments_owner_idx on tournaments (owner_id);
create index if not exists tournaments_visibility_idx on tournaments (visibility);

-- Auto invite_code generator (8 chars, no confusable glyphs)
create or replace function gen_invite_code() returns text
language plpgsql as $$
declare
  alpha text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alpha, 1 + floor(random() * length(alpha))::int, 1);
  end loop;
  return code;
end $$;

create or replace function set_invite_code_default() returns trigger
language plpgsql as $$
begin
  if new.invite_code is null then
    loop
      new.invite_code := gen_invite_code();
      exit when not exists (select 1 from tournaments where invite_code = new.invite_code);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists tournaments_invite_code on tournaments;
create trigger tournaments_invite_code before insert on tournaments
  for each row execute function set_invite_code_default();

update tournaments set invite_code = gen_invite_code() where invite_code is null;

-- ── tournament_invites: explicit invitees for private/friends tournaments ───
create table if not exists tournament_invites (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  invited_by    uuid not null references profiles(id) on delete set null,
  created_at    timestamptz default now(),
  primary key (tournament_id, profile_id)
);

create index if not exists invites_profile_idx on tournament_invites (profile_id);

-- ── helper: friends-of pair check ────────────────────────────────────────────
create or replace function are_friends(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists(
    select 1 from friendships
    where status = 'accepted'
      and user_a = least(a,b) and user_b = greatest(a,b)
  );
$$;

-- ── helper: tournament visibility check ──────────────────────────────────────
create or replace function can_view_tournament(t_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournaments t
    where t.id = t_id
      and (
        t.visibility = 'public'
        or t.owner_id = auth.uid()
        or (t.visibility = 'friends' and t.owner_id is not null and are_friends(auth.uid(), t.owner_id))
        or exists (select 1 from tournament_invites i where i.tournament_id = t.id and i.profile_id = auth.uid())
        or t.owner_id is null  -- legacy rows stay public
      )
  );
$$;

-- ── RLS overhaul ─────────────────────────────────────────────────────────────
alter table profiles            enable row level security;
alter table friendships         enable row level security;
alter table tournament_invites  enable row level security;

drop policy if exists "public_all" on tournaments;
drop policy if exists "public_all" on players;
drop policy if exists "public_all" on matches;
drop policy if exists "public_all" on hole_results;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists friendships_rw on friendships;
create policy friendships_rw on friendships for all
  using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b) and requested_by = auth.uid());

drop policy if exists tournaments_read on tournaments;
create policy tournaments_read on tournaments for select using (can_view_tournament(id));

drop policy if exists tournaments_insert on tournaments;
create policy tournaments_insert on tournaments for insert with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists tournaments_update on tournaments;
create policy tournaments_update on tournaments for update using (owner_id = auth.uid() or owner_id is null);

drop policy if exists tournaments_delete on tournaments;
create policy tournaments_delete on tournaments for delete using (owner_id = auth.uid() or owner_id is null);

drop policy if exists players_read on players;
create policy players_read on players for select using (can_view_tournament(tournament_id));

drop policy if exists players_write on players;
create policy players_write on players for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and (t.owner_id = auth.uid() or t.owner_id is null)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and (t.owner_id = auth.uid() or t.owner_id is null)));

drop policy if exists matches_read on matches;
create policy matches_read on matches for select using (can_view_tournament(tournament_id));

drop policy if exists matches_write on matches;
create policy matches_write on matches for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and (t.owner_id = auth.uid() or t.owner_id is null)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and (t.owner_id = auth.uid() or t.owner_id is null)));

drop policy if exists hole_results_read on hole_results;
create policy hole_results_read on hole_results for select
  using (exists (select 1 from matches m where m.id = match_id and can_view_tournament(m.tournament_id)));

drop policy if exists hole_results_write on hole_results;
create policy hole_results_write on hole_results for all
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null)))
  with check (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null)));

drop policy if exists invites_read on tournament_invites;
create policy invites_read on tournament_invites for select
  using (profile_id = auth.uid() or exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

drop policy if exists invites_write on tournament_invites;
create policy invites_write on tournament_invites for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

-- Realtime
do $$ begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'friendships';
  if not found then alter publication supabase_realtime add table friendships; end if;
end $$;

do $$ begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tournament_invites';
  if not found then alter publication supabase_realtime add table tournament_invites; end if;
end $$;
