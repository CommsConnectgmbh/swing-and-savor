-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Audit-Fix 2026-05-30                                     │
-- │ Behebt: P0-1 (edit_password Klartext), P0-2 (ELO winner-Manipulation),   │
-- │         P0-3 (owner_id is null Welt-Schreibrecht), P1-3 (client_debug).  │
-- │ Idempotent. Apply via Supabase SQL Editor (project rcqichlyllhwougopfkg).│
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- ════════════════════════════════════════════════════════════════════════════
-- P0-1 · edit_password darf nicht mehr im Klartext zum Client
-- ════════════════════════════════════════════════════════════════════════════
-- Strategie: Klartext-Passwort komplett aus der client-lesbaren tournaments-
-- Tabelle entfernen und in eine separate tournament_secrets-Tabelle auslagern,
-- die KEINE Rolle (anon/authenticated) SELECTen darf. So bleibt `select('*')`
-- auf tournaments gültig und enthält das Passwort nie. Ein boolesches Flag
-- has_edit_password bleibt auf tournaments lesbar; geprüft/gesetzt wird das
-- Passwort ausschließlich über security-definer RPCs.

-- Spalte defensiv sicherstellen (wurde bisher nur via Dashboard angelegt).
alter table tournaments add column if not exists edit_password text;

-- Boolesches Schatten-Flag, das der Client gefahrlos liest.
alter table tournaments add column if not exists has_edit_password boolean not null default false;

-- Secret-Tabelle: ausschließlich serverseitig (security definer) zugänglich.
create table if not exists tournament_secrets (
  tournament_id uuid primary key references tournaments(id) on delete cascade,
  edit_password text not null
);
alter table tournament_secrets enable row level security;
-- Keine Policies = kein direkter Zugriff für anon/authenticated. RPCs nutzen
-- security definer und umgehen RLS bewusst.
revoke all on tournament_secrets from anon, authenticated;

-- Bestehende Klartext-Passwörter migrieren und Flag backfillen.
insert into tournament_secrets (tournament_id, edit_password)
  select id, edit_password from tournaments
  where edit_password is not null and length(btrim(edit_password)) > 0
on conflict (tournament_id) do update set edit_password = excluded.edit_password;

update tournaments set has_edit_password = true
  where id in (select tournament_id from tournament_secrets);

-- Klartext-Spalte auf tournaments entfernen (Quelle der Leakage).
alter table tournaments drop column if exists edit_password;

-- security-definer RPC: prüft das Passwort serverseitig, gibt nur boolean.
create or replace function verify_tournament_password(t_id uuid, pw text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournament_secrets s
    where s.tournament_id = t_id
      and s.edit_password = pw
  );
$$;

revoke all on function verify_tournament_password(uuid, text) from public;
grant execute on function verify_tournament_password(uuid, text) to anon, authenticated;

-- security-definer RPC: setzt/entfernt das Passwort. Nur der Owner darf das.
-- pw NULL/leer ⇒ Passwort entfernen.
create or replace function set_tournament_password(t_id uuid, pw text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  is_owner boolean;
begin
  select (owner_id = auth.uid()) into is_owner from tournaments where id = t_id;
  if not coalesce(is_owner, false) then
    raise exception 'not authorized';
  end if;

  if pw is null or length(btrim(pw)) = 0 then
    delete from tournament_secrets where tournament_id = t_id;
    update tournaments set has_edit_password = false where id = t_id;
  else
    insert into tournament_secrets (tournament_id, edit_password)
      values (t_id, pw)
    on conflict (tournament_id) do update set edit_password = excluded.edit_password;
    update tournaments set has_edit_password = true where id = t_id;
  end if;
end $$;

revoke all on function set_tournament_password(uuid, text) from public;
grant execute on function set_tournament_password(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- P0-3 · owner_id is null macht Legacy-Cups welt-schreibbar/-löschbar
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Legacy-Zeilen ohne Owner einem System-Fallback-Owner zuordnen, damit
--    not-null erzwingbar wird ohne bestehende Daten zu verlieren.
--    Fallback = ältestes Profil (deterministisch); existiert kein Profil,
--    bleibt not-null-Enforcement aus (kein Profil ⇒ keine Schreiber).
do $$
declare
  fallback_owner uuid;
begin
  if exists (select 1 from tournaments where owner_id is null) then
    select id into fallback_owner from profiles order by created_at asc, id asc limit 1;
    if fallback_owner is not null then
      update tournaments set owner_id = fallback_owner where owner_id is null;
    end if;
  end if;
end $$;

-- 2) not-null erzwingen — nur wenn keine NULLs mehr existieren (sonst no-op,
--    damit die Migration auf einer profillosen DB nicht hart failt).
do $$
begin
  if not exists (select 1 from tournaments where owner_id is null) then
    alter table tournaments alter column owner_id set not null;
  end if;
end $$;

-- 3) Write-Policies ohne den "or owner_id is null"-Zweig neu setzen.
drop policy if exists tournaments_insert on tournaments;
create policy tournaments_insert on tournaments for insert
  with check (owner_id = auth.uid());

drop policy if exists tournaments_update on tournaments;
create policy tournaments_update on tournaments for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists tournaments_delete on tournaments;
create policy tournaments_delete on tournaments for delete
  using (owner_id = auth.uid());

drop policy if exists players_write on players;
create policy players_write on players for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

drop policy if exists matches_write on matches;
create policy matches_write on matches for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid()));

drop policy if exists hole_results_write on hole_results;
create policy hole_results_write on hole_results for all
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_id and t.owner_id = auth.uid()));

-- 4) can_view_tournament: legacy-"owner_id is null = public" entfernen.
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
      )
  );
$$;

-- 5) can_view_match: ebenfalls "owner_id is null"-Zweig entfernen.
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
       or (v = 'friends' and owner_id is not null and are_friends(auth.uid(), owner_id))
       or exists (select 1 from tournament_invites i where i.tournament_id = tid and i.profile_id = auth.uid())
  );
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- P0-2 · ELO über client-gesetzten match.winner manipulierbar
-- ════════════════════════════════════════════════════════════════════════════

-- Serverseitige Neuberechnung des Gewinners aus den gespeicherten hole_results.
-- Respektiert match.format (match_play | stableford) und die Team-Faktoren.
-- Gibt 'A' | 'B' | 'halved' | null (keine Holes) zurück.
create or replace function compute_match_winner(m_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  m       record;
  cnt     int;
  raw_a   numeric := 0;
  raw_b   numeric := 0;
  sb_a    numeric := 0;
  sb_b    numeric := 0;
  hr      record;
  diff    int;
begin
  select format, team_a_factor, team_b_factor into m from matches where id = m_id;
  if not found then return null; end if;

  select count(*) into cnt from hole_results where match_id = m_id;
  if cnt = 0 then return null; end if;

  if coalesce(m.format, 'match_play') = 'stableford' then
    -- Brutto-Stableford pro Loch: Eagle 4 / Birdie 3 / Par 2 / Bogey 1 / sonst 0.
    -- par kommt aus matches.hole_pars; fehlt es, default 4.
    for hr in
      select hr.hole_number, hr.strokes_a, hr.strokes_b,
             coalesce((select (mm.hole_pars)[hr.hole_number] from matches mm where mm.id = m_id), 4) as par
      from hole_results hr where hr.match_id = m_id
    loop
      if hr.strokes_a >= 1 and hr.par >= 3 then
        diff := hr.strokes_a - hr.par;
        sb_a := sb_a + case when diff <= -2 then 4 when diff = -1 then 3 when diff = 0 then 2 when diff = 1 then 1 else 0 end;
      end if;
      if hr.strokes_b >= 1 and hr.par >= 3 then
        diff := hr.strokes_b - hr.par;
        sb_b := sb_b + case when diff <= -2 then 4 when diff = -1 then 3 when diff = 0 then 2 when diff = 1 then 1 else 0 end;
      end if;
    end loop;
    if sb_a > sb_b then return 'A';
    elsif sb_b > sb_a then return 'B';
    else return 'halved'; end if;
  else
    -- Match-Play: gewonnene Löcher zählen (Faktoren wie im Client).
    select
      sum(case when winner = 'A' then 1 else 0 end),
      sum(case when winner = 'B' then 1 else 0 end)
    into raw_a, raw_b
    from hole_results where match_id = m_id;
    raw_a := coalesce(raw_a, 0) * coalesce(m.team_a_factor, 1);
    raw_b := coalesce(raw_b, 0) * coalesce(m.team_b_factor, 1);
    if raw_a > raw_b then return 'A';
    elsif raw_b > raw_a then return 'B';
    else return 'halved'; end if;
  end if;
end $$;

-- Trigger auf matches: beim Finish den client-gesetzten winner durch den
-- serverseitig berechneten ERSETZEN (Client-winner = nur optimistisches Echo).
-- BEFORE-Trigger, damit der korrigierte Wert persistiert wird und die
-- nachgelagerte Challenge-Propagation (AFTER) den validierten Wert sieht.
create or replace function trg_match_finish_validate_winner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  computed text;
begin
  if new.status = 'finished' and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    computed := compute_match_winner(new.id);
    if computed is not null then
      new.winner := computed;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists matches_finish_validate_winner on matches;
create trigger matches_finish_validate_winner before update on matches
  for each row execute function trg_match_finish_validate_winner();

-- ════════════════════════════════════════════════════════════════════════════
-- P1-3 · client_debug — offene, unauthentifizierte Schreib-Senke schließen
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists client_debug_insert_anyone on client_debug;
create policy client_debug_insert_authed on client_debug for insert
  with check (auth.uid() is not null);
