-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Social-Layer v2                                         │
-- │ Match-Visibility · Foto · Team-Templates · Messaging · ELO              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- ── matches: visibility-override pro Match + Foto ────────────────────────────
alter table matches
  add column if not exists visibility text
    check (visibility is null or visibility in ('public','friends','private')),
  add column if not exists photo_url  text;

comment on column matches.visibility is 'Override über tournaments.visibility. NULL = erbt vom Turnier.';
comment on column matches.photo_url  is 'Optionales Cover-Foto, public-read aus dem match-photos Bucket.';

-- ── helper: effective visibility of a match (match-override OR tournament) ───
create or replace function can_view_match(m_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with eff as (
    select
      coalesce(m.visibility, t.visibility) as v,
      t.owner_id, t.id as tid
    from matches m
    join tournaments t on t.id = m.tournament_id
    where m.id = m_id
  )
  select exists (
    select 1 from eff
    where v = 'public'
       or owner_id = auth.uid()
       or owner_id is null
       or (v = 'friends' and owner_id is not null and are_friends(auth.uid(), owner_id))
       or exists (select 1 from tournament_invites i where i.tournament_id = tid and i.profile_id = auth.uid())
  );
$$;

-- ── team_templates: wiederverwendbare Stammflights pro User ─────────────────
create table if not exists team_templates (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null check (length(name) between 1 and 60),
  members     jsonb not null default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
comment on table  team_templates is 'Pro User gespeicherte Spieler-Listen (z.B. „Mein Stammflight").';
comment on column team_templates.members is 'JSON-Array: [{ "name": "Hans", "handicap": 12.4 }, ...]';

create index if not exists team_templates_owner_idx on team_templates (owner_id);
alter table team_templates enable row level security;

drop policy if exists team_templates_own on team_templates;
create policy team_templates_own on team_templates for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── profiles: ELO + Counter für die globale Rangliste ───────────────────────
alter table profiles
  add column if not exists elo_rating    int  not null default 1500,
  add column if not exists games_played  int  not null default 0,
  add column if not exists wins          int  not null default 0,
  add column if not exists country_code  text;

create index if not exists profiles_elo_idx on profiles (elo_rating desc);

-- ── players: optional Profile-Link für Stats über Tournament-Grenzen ────────
alter table players
  add column if not exists profile_id uuid references profiles(id) on delete set null;
create index if not exists players_profile_idx on players (profile_id);

-- ── conversations + messages: 1:1 DM, Friends-only ──────────────────────────
create table if not exists conversations (
  id              uuid primary key default uuid_generate_v4(),
  user_a          uuid not null references profiles(id) on delete cascade,
  user_b          uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz default now(),
  last_message_at timestamptz default now(),
  unique (user_a, user_b),
  check  (user_a < user_b)
);

create index if not exists conversations_user_a_idx on conversations (user_a, last_message_at desc);
create index if not exists conversations_user_b_idx on conversations (user_b, last_message_at desc);

create table if not exists messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (length(body) between 1 and 2000),
  created_at      timestamptz default now(),
  read_at         timestamptz
);

create index if not exists messages_conv_idx on messages (conversation_id, created_at desc);

alter table conversations enable row level security;
alter table messages      enable row level security;

drop policy if exists conv_read on conversations;
create policy conv_read on conversations for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists conv_insert on conversations;
create policy conv_insert on conversations for insert with check (
  (user_a = auth.uid() or user_b = auth.uid())
  and are_friends(user_a, user_b)   -- nur unter Freunden ein DM aufmachen
);

drop policy if exists msg_read on messages;
create policy msg_read on messages for select using (
  exists (select 1 from conversations c
          where c.id = conversation_id
            and (c.user_a = auth.uid() or c.user_b = auth.uid()))
);

drop policy if exists msg_insert on messages;
create policy msg_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from conversations c
              where c.id = conversation_id
                and (c.user_a = auth.uid() or c.user_b = auth.uid())
                and are_friends(c.user_a, c.user_b))
);

drop policy if exists msg_update on messages;
create policy msg_update on messages for update using (
  -- Empfänger darf read_at setzen
  sender_id <> auth.uid()
  and exists (select 1 from conversations c
              where c.id = conversation_id
                and (c.user_a = auth.uid() or c.user_b = auth.uid()))
);

-- Trigger: jede neue Message rollt last_message_at hoch
create or replace function bump_conv_last_message() returns trigger
language plpgsql security definer as $$
begin
  update conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists msg_bump_conv on messages;
create trigger msg_bump_conv after insert on messages
  for each row execute function bump_conv_last_message();

-- Realtime
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages';
  if not found then alter publication supabase_realtime add table messages; end if;
end $$;
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='conversations';
  if not found then alter publication supabase_realtime add table conversations; end if;
end $$;

-- RPC: hole oder erstelle Conversation für Friend-Paar (canonical ordering)
create or replace function get_or_create_conversation(other_user uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ua uuid; ub uuid; cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not are_friends(me, other_user) then raise exception 'not friends'; end if;
  ua := least(me, other_user);
  ub := greatest(me, other_user);
  select id into cid from conversations where user_a = ua and user_b = ub;
  if cid is null then
    insert into conversations (user_a, user_b) values (ua, ub) returning id into cid;
  end if;
  return cid;
end $$;

revoke all on function get_or_create_conversation(uuid) from public;
grant execute on function get_or_create_conversation(uuid) to authenticated;

-- ── ELO update nach Challenge-Finish (1v1, beide Seiten Profile-IDs) ────────
create or replace function update_elo_for_challenge(c_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c       record;
  elo_a   int;
  elo_b   int;
  expA    numeric;
  actA    numeric;
  actB    numeric;
  k_factor int := 32;
  delta_a int;
  delta_b int;
begin
  select * into c from challenges where id = c_id;
  if c.id is null or c.status <> 'finished' then return; end if;
  if c.type <> 'singles' then return; end if;
  if c.challenger_id is null or c.opponent_id is null then return; end if;
  if c.winner_side is null then return; end if;

  select elo_rating into elo_a from profiles where id = c.challenger_id;
  select elo_rating into elo_b from profiles where id = c.opponent_id;
  if elo_a is null or elo_b is null then return; end if;

  expA := 1.0 / (1.0 + power(10.0, (elo_b - elo_a) / 400.0));

  if    c.winner_side = 'challenger' then actA := 1.0; actB := 0.0;
  elsif c.winner_side = 'opponent'   then actA := 0.0; actB := 1.0;
  else                                    actA := 0.5; actB := 0.5;
  end if;

  delta_a := round(k_factor * (actA - expA));
  delta_b := round(k_factor * (actB - (1.0 - expA)));

  update profiles
     set elo_rating   = greatest(0, elo_rating + delta_a),
         games_played = games_played + 1,
         wins         = wins + case when actA = 1.0 then 1 else 0 end
   where id = c.challenger_id;

  update profiles
     set elo_rating   = greatest(0, elo_rating + delta_b),
         games_played = games_played + 1,
         wins         = wins + case when actB = 1.0 then 1 else 0 end
   where id = c.opponent_id;
end $$;

revoke all on function update_elo_for_challenge(uuid) from public;
grant execute on function update_elo_for_challenge(uuid) to authenticated;

-- Trigger: bei Challenge-Status auf 'finished' → ELO aktualisieren
create or replace function trg_challenge_finish_elo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE') and new.status = 'finished' and (old.status is distinct from 'finished') then
    perform update_elo_for_challenge(new.id);
  end if;
  return new;
end $$;

drop trigger if exists challenges_finish_elo on challenges;
create trigger challenges_finish_elo after update on challenges
  for each row execute function trg_challenge_finish_elo();

-- Wenn der mit einem Challenge verknüpfte Match fertig wird, Challenge auto-
-- finalisieren (Mapping: match.winner A/B/halved → winner_side challenger/opponent/halved)
create or replace function trg_match_finish_propagate_challenge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_id uuid;
  ws   text;
begin
  if (tg_op = 'UPDATE') and new.status = 'finished' and (old.status is distinct from 'finished') then
    select id into c_id from challenges where match_id = new.id and status <> 'finished' limit 1;
    if c_id is not null then
      ws := case new.winner
              when 'A' then 'challenger'
              when 'B' then 'opponent'
              when 'halved' then 'halved'
              else null end;
      update challenges
         set status = 'finished',
             winner_side = ws,
             finished_at = now()
       where id = c_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists matches_finish_propagate on matches;
create trigger matches_finish_propagate after update on matches
  for each row execute function trg_match_finish_propagate_challenge();

-- ── public-leaderboard view (top 100 nach ELO) ──────────────────────────────
create or replace view leaderboard_global as
  select id, handle, display_name, avatar_url, elo_rating, games_played, wins, country_code
  from profiles
  where games_played > 0
  order by elo_rating desc, wins desc, handle asc
  limit 200;

grant select on leaderboard_global to anon, authenticated;
