-- Supabase-Advisor (Stand 07.10.2026): drei neue Warnungen seit dem Bericht vom 02.06.
--
-- 1) function_search_path_mutable: support_touch_updated_at() ohne festen search_path.
-- 2) anon_security_definer_function_executable: support_bump_activity() ist eine reine
--    Trigger-Funktion (trg_support_msg_activity). Triggerfunktionen brauchen beim Feuern kein
--    EXECUTE-Recht, das Recht wird nur bei CREATE TRIGGER geprüft. Also allen API-Rollen entziehen.
-- 3) anon_security_definer_function_executable: verify_tournament_password(uuid, text).
--    Alle Aufrufer (PasswordGate in Board/Teams/Matches/MatchDetail/Cup) liegen hinter dem Login,
--    die öffentlichen Routen (/c, /i, /recap, /hall, /crew, /season) nutzen sie nicht.
--    Deshalb nur noch authenticated. Dazu Fehlversuche begrenzen: höchstens 10 falsche Passwörter
--    je Nutzer und Turnier in 15 Minuten (per Advisory-Lock nebenläufigkeitssicher), danach liefert die Prüfung false, ohne das Passwort zu
--    vergleichen. Die Rückgabe bleibt boolean, der Client ändert sich nicht.

alter function public.support_touch_updated_at() set search_path = public;
revoke execute on function public.support_touch_updated_at() from public, anon, authenticated;

revoke execute on function public.support_bump_activity() from public, anon, authenticated;

create table if not exists public.tournament_password_attempts (
  user_id       uuid        not null,
  tournament_id uuid        not null,
  attempted_at  timestamptz not null default now()
);
create index if not exists tournament_password_attempts_lookup
  on public.tournament_password_attempts (user_id, tournament_id, attempted_at);
alter table public.tournament_password_attempts enable row level security;
revoke all on table public.tournament_password_attempts from anon, authenticated;

create or replace function public.verify_tournament_password(t_id uuid, pw text)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ok  boolean;
begin
  if uid is null then
    return false;
  end if;

  -- Zählen, Prüfen und Eintragen je Nutzer und Turnier serialisieren, damit parallele Aufrufe
  -- nicht alle denselben Zählerstand unter 10 lesen.
  perform pg_advisory_xact_lock(hashtextextended('verify_tournament_password:' || uid || ':' || t_id, 0));

  delete from tournament_password_attempts
   where user_id = uid and attempted_at < now() - interval '1 day';

  if (select count(*) from tournament_password_attempts
       where user_id = uid and tournament_id = t_id
         and attempted_at > now() - interval '15 minutes') >= 10 then
    return false;
  end if;

  select exists (
    select 1 from tournament_secrets s
     where s.tournament_id = t_id and s.edit_password = pw
  ) into ok;

  if not ok then
    insert into tournament_password_attempts (user_id, tournament_id) values (uid, t_id);
  end if;

  return ok;
end $$;

revoke all on function public.verify_tournament_password(uuid, text) from public, anon;
grant execute on function public.verify_tournament_password(uuid, text) to authenticated;
