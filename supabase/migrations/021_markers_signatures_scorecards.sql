-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Marker, Signaturen, Per-Player-Scoring                 │
-- │ Echter Golf-Scorecard-Flow: jeder Spieler hat einen Zähler (Marker),   │
-- │ Zähler trägt Scores ein, beide unterschreiben am Ende digital.         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Wer zählt für wen pro Match
create table if not exists match_markers (
  match_id         uuid not null references matches(id) on delete cascade,
  player_id        uuid not null references players(id) on delete cascade,
  marker_player_id uuid not null references players(id) on delete cascade,
  assigned_at      timestamptz not null default now(),
  assigned_by      uuid references profiles(id) on delete set null,
  primary key (match_id, player_id),
  check (player_id <> marker_player_id)
);
create index if not exists mm_marker_idx on match_markers (match_id, marker_player_id);

-- Digitale Unterschriften pro Scorekarte
create table if not exists match_signatures (
  match_id        uuid not null references matches(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade, -- die Karte gehört diesem Spieler
  role            text not null check (role in ('player','marker')),
  signer_user_id  uuid references auth.users(id) on delete set null,
  signer_label    text, -- bei anonymen Spielern (kein Account): freier Name
  device_label    text,
  signed_at       timestamptz not null default now(),
  primary key (match_id, player_id, role)
);
create index if not exists ms_match_idx on match_signatures (match_id);

-- Per-Player-Hole-Scores (Stroke-Play / Echte Scorekarte)
create table if not exists player_hole_scores (
  match_id              uuid not null references matches(id) on delete cascade,
  player_id             uuid not null references players(id) on delete cascade,
  hole_number           int  not null check (hole_number between 1 and 18),
  strokes               int  check (strokes is null or strokes between 1 and 20),
  putts                 int  check (putts is null or putts between 0 and 10),
  entered_by_player_id  uuid references players(id) on delete set null,
  entered_by_user_id    uuid references auth.users(id) on delete set null,
  updated_at            timestamptz not null default now(),
  source                text not null default 'manual'
                              check (source in ('manual','ocr','imported')),
  primary key (match_id, player_id, hole_number)
);
create index if not exists phs_player_idx on player_hole_scores (match_id, player_id);

-- View: locked, wenn beide Signaturen (player + marker) vorliegen
create or replace view match_player_locked as
  select s1.match_id, s1.player_id
    from match_signatures s1
    join match_signatures s2
      on s2.match_id = s1.match_id and s2.player_id = s1.player_id and s2.role <> s1.role
   where s1.role in ('player','marker')
   group by s1.match_id, s1.player_id;

grant select on match_player_locked to anon, authenticated;

-- RLS — Read: jeder der den Match sehen darf
alter table match_markers       enable row level security;
alter table match_signatures    enable row level security;
alter table player_hole_scores  enable row level security;

drop policy if exists mm_read  on match_markers;
drop policy if exists ms_read  on match_signatures;
drop policy if exists phs_read on player_hole_scores;
create policy mm_read  on match_markers       for select using (can_view_match(match_id));
create policy ms_read  on match_signatures    for select using (can_view_match(match_id));
create policy phs_read on player_hole_scores  for select using (can_view_match(match_id));

-- RLS — Write Markers: Tournament-Owner
drop policy if exists mm_write on match_markers;
create policy mm_write on match_markers for all
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
                 where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null)))
  with check (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
                      where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null)));

-- RLS — Write Hole-Scores: Tournament-Owner ODER zugewiesener Marker (per Profil verlinkt)
drop policy if exists phs_write on player_hole_scores;
create policy phs_write on player_hole_scores for all
  using (
    exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
            where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null))
    or exists (select 1 from match_markers mm
               join players p on p.id = mm.marker_player_id
               where mm.match_id = player_hole_scores.match_id
                 and mm.player_id = player_hole_scores.player_id
                 and p.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
            where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null))
    or exists (select 1 from match_markers mm
               join players p on p.id = mm.marker_player_id
               where mm.match_id = player_hole_scores.match_id
                 and mm.player_id = player_hole_scores.player_id
                 and p.profile_id = auth.uid())
  );

-- RLS — Write Signatures: signer schreibt eigene Signatur (player oder marker)
drop policy if exists ms_insert on match_signatures;
create policy ms_insert on match_signatures for insert with check (
  signer_user_id = auth.uid()
  and (
    -- player-Signatur: nur eigener Player-Slot
    (role = 'player'
       and exists (select 1 from players p
                   where p.id = player_id and p.profile_id = auth.uid()))
    -- marker-Signatur: muss der zugewiesene Marker sein
    or (role = 'marker'
       and exists (select 1 from match_markers mm
                   join players p on p.id = mm.marker_player_id
                   where mm.match_id = match_signatures.match_id
                     and mm.player_id = match_signatures.player_id
                     and p.profile_id = auth.uid()))
    -- Fallback: Tournament-Owner darf für anonyme Spieler unterschreiben
    or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
               where m.id = match_signatures.match_id and t.owner_id = auth.uid())
  )
);

drop policy if exists ms_delete on match_signatures;
create policy ms_delete on match_signatures for delete using (
  signer_user_id = auth.uid()
  or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
             where m.id = match_id and t.owner_id = auth.uid())
);

-- Shuffle-Helper: rotiert Marker zyklisch innerhalb Team-Mitglieder
-- (A1->A2->A3->A1, B1->B2->B3->B1) oder cross-team wenn nur 1 pro Seite
create or replace function shuffle_match_markers(m_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  m record;
  ids uuid[];
  n   int;
  i   int;
  cnt int := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into m from matches where id = m_id;
  if m.id is null then raise exception 'not_found'; end if;
  if not exists (select 1 from tournaments t where t.id = m.tournament_id
                 and (t.owner_id = auth.uid() or t.owner_id is null)) then
    raise exception 'not_owner';
  end if;

  -- alle Spieler beider Teams in zyklische Liste
  ids := coalesce(m.team_a_player_ids, '{}'::uuid[])
      || coalesce(m.team_b_player_ids, '{}'::uuid[]);
  -- Legacy-Singles/Doubles
  if coalesce(array_length(ids,1), 0) = 0 then
    ids := array_remove(array[m.team_a_player1_id, m.team_a_player2_id,
                              m.team_b_player1_id, m.team_b_player2_id]::uuid[], null);
  end if;
  n := coalesce(array_length(ids, 1), 0);
  if n < 2 then return 0; end if;

  -- alte Marker löschen
  delete from match_markers where match_id = m_id;

  -- jeder zählt für den nächsten in der Liste
  for i in 1..n loop
    insert into match_markers (match_id, player_id, marker_player_id, assigned_by)
    values (m_id, ids[(i % n) + 1], ids[i], auth.uid())
    on conflict (match_id, player_id) do update
      set marker_player_id = excluded.marker_player_id,
          assigned_at = now(),
          assigned_by = auth.uid();
    cnt := cnt + 1;
  end loop;
  return cnt;
end $$;

grant execute on function shuffle_match_markers(uuid) to authenticated;

-- Realtime
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='match_markers';
  if not found then alter publication supabase_realtime add table match_markers; end if;
end $$;
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='match_signatures';
  if not found then alter publication supabase_realtime add table match_signatures; end if;
end $$;
do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='player_hole_scores';
  if not found then alter publication supabase_realtime add table player_hole_scores; end if;
end $$;
