-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor · Spieler tragen ihre Löcher selbst ein (2026-10-01)        │
-- │                                                                           │
-- │ Problem: Seit 029 darf nur der Cup-Ersteller hole_results schreiben und   │
-- │ den Match-Status setzen. Das widerspricht dem Produktversprechen „jeder   │
-- │ im Flight trägt direkt auf dem Platz ein“; Eingaben der Mitspieler        │
-- │ scheitern an RLS.                                                         │
-- │                                                                           │
-- │ Lösung, ohne die Ziele von 029 aufzuweichen:                              │
-- │  * Teilnehmer eines Matches = players-Zeile dieses Cups, die per          │
-- │    profile_id mit dem eingeloggten Account verknüpft ist UND in genau     │
-- │    diesem Match aufgestellt ist (Singles/Doubles-Slots oder Flight-Arrays).│
-- │  * Teilnehmer dürfen hole_results ihres Matches anlegen/ändern, solange   │
-- │    das Match nicht beendet ist. Löschen bleibt dem Ersteller vorbehalten. │
-- │  * Teilnehmer dürfen am Match NUR status (pending→active→finished) und    │
-- │    winner ändern; alle anderen Spalten sind per Trigger gesperrt. Beim    │
-- │    Beenden durch einen Teilnehmer wird winner immer serverseitig aus den  │
-- │    hole_results berechnet (kein Client-winner, auch nicht bei 0 Löchern). │
-- │  * Ein beendetes Match kann ein Teilnehmer nicht wieder öffnen.           │
-- │  * Spieler eines Cups dürfen ihren Cup/ihr Match sehen (sonst könnten     │
-- │    Teilnehmer privater Cups gar nicht eintragen).                         │
-- │  * Ersteller-Rechte (owner_id = auth.uid()) bleiben unverändert;          │
-- │    tournaments-/players-Schreibrechte bleiben owner-only.                 │
-- │                                                                           │
-- │ Idempotent. NICHT ohne Review auf Produktion anwenden.                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- ── 1. Helper: ist der eingeloggte Account Teilnehmer dieses Matches? ───────
-- SECURITY DEFINER + fester search_path: liest matches/players ohne RLS-
-- Rekursion (Policies auf matches/hole_results rufen diese Funktion).
create or replace function is_match_participant(m_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1
      from matches m
      join players p on p.tournament_id = m.tournament_id
     where m.id = m_id
       and p.profile_id = auth.uid()
       and (
         p.id in (m.team_a_player1_id, m.team_a_player2_id,
                  m.team_b_player1_id, m.team_b_player2_id)
         or p.id = any(coalesce(m.team_a_player_ids, '{}'::uuid[])
                    || coalesce(m.team_b_player_ids, '{}'::uuid[]))
       )
  );
$$;

revoke all on function is_match_participant(uuid) from public, anon;
grant execute on function is_match_participant(uuid) to authenticated;

-- Teilnehmer darf Löcher schreiben: Teilnehmer UND Match nicht beendet.
create or replace function can_participant_score(m_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_match_participant(m_id)
     and exists (select 1 from matches m
                  where m.id = m_id and m.status is distinct from 'finished');
$$;

revoke all on function can_participant_score(uuid) from public, anon;
grant execute on function can_participant_score(uuid) to authenticated;

-- ── 2. hole_results: zusätzliche Policies für Teilnehmer ────────────────────
-- Die Ersteller-Policy hole_results_write (029) bleibt unverändert bestehen.
-- Permissive Policies werden OR-verknüpft; DELETE erhalten Teilnehmer nicht.
drop policy if exists hole_results_insert_participant on hole_results;
create policy hole_results_insert_participant on hole_results
  for insert to authenticated
  with check (can_participant_score(match_id));

drop policy if exists hole_results_update_participant on hole_results;
create policy hole_results_update_participant on hole_results
  for update to authenticated
  using (can_participant_score(match_id))
  with check (can_participant_score(match_id));

-- ── 3. matches: Teilnehmer dürfen nur den Status fortschreiben ──────────────
drop policy if exists matches_update_participant on matches;
create policy matches_update_participant on matches
  for update to authenticated
  using (is_match_participant(id))
  with check (is_match_participant(id));

-- Spalten-Wächter: RLS kann keine Spalten einschränken, deshalb ein
-- BEFORE-UPDATE-Trigger. Läuft nach matches_finish_validate_winner
-- (Trigger feuern alphabetisch), überschreibt winner für Teilnehmer also
-- final mit dem serverseitig berechneten Wert.
create or replace function trg_match_participant_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_owner boolean;
begin
  -- Interne Aufrufe ohne Endnutzer-JWT (service_role, Trigger, Cron):
  -- unverändert durchlassen.
  if auth.uid() is null then
    return new;
  end if;

  select (t.owner_id = auth.uid()) into is_owner
    from tournaments t where t.id = old.tournament_id;
  if coalesce(is_owner, false) then
    return new;
  end if;

  -- Ab hier: Teilnehmer (RLS hat alle anderen bereits ausgeschlossen).
  if (to_jsonb(new) - 'status' - 'winner') is distinct from (to_jsonb(old) - 'status' - 'winner') then
    raise exception 'participants may only update match status'
      using errcode = '42501';
  end if;

  if old.status = 'finished' and new.status is distinct from 'finished' then
    raise exception 'finished match cannot be reopened by participants'
      using errcode = '42501';
  end if;

  if old.status = 'active' and new.status = 'pending' then
    raise exception 'invalid status transition'
      using errcode = '42501';
  end if;

  if new.status = 'finished' then
    -- Nie einen client-gesetzten winner übernehmen.
    new.winner := compute_match_winner(new.id);
  else
    new.winner := old.winner;
  end if;

  return new;
end $$;

revoke all on function trg_match_participant_guard() from public, anon, authenticated;

drop trigger if exists matches_participant_guard on matches;
create trigger matches_participant_guard before update on matches
  for each row execute function trg_match_participant_guard();

-- ── 4. Sichtbarkeit: Spieler eines Cups sehen ihren Cup und ihre Matches ────
-- Definition entspricht dem Live-Stand (029), ergänzt nur um den players-Zweig.
create or replace function can_view_tournament(t_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournaments t
    where t.id = t_id
      and (
        t.visibility = 'public'
        or t.owner_id = auth.uid()
        or (t.visibility = 'friends' and t.owner_id is not null and are_friends(auth.uid(), t.owner_id))
        or exists (select 1 from tournament_invites i where i.tournament_id = t.id and i.profile_id = auth.uid())
        or exists (select 1 from players p where p.tournament_id = t.id and p.profile_id = auth.uid())
      )
  );
$$;

create or replace function can_view_match(m_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  with eff as (
    select coalesce(m.visibility, t.visibility) as v, t.owner_id, t.id as tid
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
       or exists (select 1 from players p where p.tournament_id = tid and p.profile_id = auth.uid())
  );
$$;
