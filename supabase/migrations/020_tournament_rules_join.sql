-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Regeln, Bedingungen & Beitritts-Flow                   │
-- │ Hosts hinterlegen Regeln/Bedingungen, Mitspieler können beitreten oder │
-- │ Beitritt anfragen (je nach join_mode), nach Bestätigung der Regeln.   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table tournaments
  add column if not exists rules_md            text,
  add column if not exists entry_conditions    jsonb not null default '{}'::jsonb,
  add column if not exists max_participants    int   check (max_participants is null or max_participants between 2 and 1024),
  add column if not exists join_mode           text  not null default 'invite_only'
                                  check (join_mode in ('invite_only','open','request'));

comment on column tournaments.rules_md is 'Markdown — Turnierregeln, Format-Details, Etikette, Tee-Times etc.';
comment on column tournaments.entry_conditions is
  'Strukturierte Bedingungen: { handicap_max, handicap_min, age_min, gender, dress_code, entry_fee_cents, payout, equipment }';
comment on column tournaments.join_mode is
  'invite_only = altes Verhalten; open = Self-Join nach Regel-Bestätigung; request = Beitritt-Anfrage mit Owner-Approval.';

-- Beitritts-Anfragen / Self-Joins (Audit + Consent)
create table if not exists tournament_join_requests (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references tournaments(id) on delete cascade,
  profile_id         uuid not null references profiles(id) on delete cascade,
  status             text not null default 'pending'
                          check (status in ('pending','approved','rejected','withdrawn')),
  rules_accepted_at  timestamptz not null default now(),
  rules_version_hash text,
  display_name       text,
  handicap           numeric(4,1),
  message            text,
  resolved_by        uuid references profiles(id) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz default now(),
  unique (tournament_id, profile_id)
);

create index if not exists joinreq_tournament_idx on tournament_join_requests (tournament_id);
create index if not exists joinreq_profile_idx    on tournament_join_requests (profile_id);
create index if not exists joinreq_status_idx     on tournament_join_requests (status);

alter table tournament_join_requests enable row level security;

drop policy if exists joinreq_read on tournament_join_requests;
create policy joinreq_read on tournament_join_requests for select using (
  profile_id = auth.uid()
  or exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
);

drop policy if exists joinreq_insert_self on tournament_join_requests;
create policy joinreq_insert_self on tournament_join_requests for insert with check (
  profile_id = auth.uid()
  and exists (
    select 1 from tournaments t where t.id = tournament_id
      and t.join_mode in ('open','request')
      and (t.visibility = 'public'
           or (t.visibility = 'friends' and t.owner_id is not null and are_friends(auth.uid(), t.owner_id))
           or exists (select 1 from tournament_invites i
                      where i.tournament_id = t.id and i.profile_id = auth.uid()))
  )
);

drop policy if exists joinreq_update_owner on tournament_join_requests;
create policy joinreq_update_owner on tournament_join_requests for update using (
  profile_id = auth.uid()
  or exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
);

-- RPC: nimmt Owner-Approval und legt automatisch player-row an
create or replace function approve_join_request(req_id uuid, team_letter text default 'A')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r record;
  pid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select jr.*, t.owner_id as o_id, t.visibility as v
    into r
    from tournament_join_requests jr
    join tournaments t on t.id = jr.tournament_id
   where jr.id = req_id;
  if r.id is null then raise exception 'not_found'; end if;
  if r.o_id is not null and r.o_id <> auth.uid() then raise exception 'not_owner'; end if;
  if r.status <> 'pending' then return null; end if;

  insert into players (tournament_id, name, handicap, team, profile_id)
  values (r.tournament_id,
          coalesce(r.display_name, (select display_name from profiles where id = r.profile_id), 'Spieler'),
          coalesce(r.handicap, 28),
          case when team_letter in ('A','B') then team_letter else 'A' end,
          r.profile_id)
  returning id into pid;

  update tournament_join_requests
     set status = 'approved', resolved_by = auth.uid(), resolved_at = now()
   where id = req_id;
  return pid;
end $$;

grant execute on function approve_join_request(uuid, text) to authenticated;

-- RPC: Self-Join für open mode (kein Owner-Approval nötig)
create or replace function join_open_tournament(t_id uuid, accepted boolean default true)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t record;
  pid uuid;
  prof record;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not accepted then raise exception 'rules_not_accepted'; end if;
  select * into t from tournaments where id = t_id;
  if t.id is null then raise exception 'not_found'; end if;
  if t.join_mode <> 'open' then raise exception 'not_open'; end if;

  select * into prof from profiles where id = auth.uid();

  -- idempotent: existing player by profile?
  select id into pid from players
    where tournament_id = t_id and profile_id = auth.uid() limit 1;
  if pid is not null then return pid; end if;

  insert into players (tournament_id, name, handicap, team, profile_id)
  values (t_id, coalesce(prof.display_name, 'Spieler'), coalesce(prof.hcp, 28), 'A', auth.uid())
  returning id into pid;

  insert into tournament_join_requests (tournament_id, profile_id, status, rules_accepted_at, display_name, handicap, resolved_at)
  values (t_id, auth.uid(), 'approved', now(), prof.display_name, prof.hcp, now())
  on conflict (tournament_id, profile_id) do update
    set status = 'approved', rules_accepted_at = now(), resolved_at = now();
  return pid;
end $$;

grant execute on function join_open_tournament(uuid, boolean) to authenticated;

-- Realtime
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='tournament_join_requests';
  if not found then alter publication supabase_realtime add table tournament_join_requests; end if;
end $$;
