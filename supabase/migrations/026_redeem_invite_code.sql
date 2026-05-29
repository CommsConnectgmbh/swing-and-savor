-- ╭──────────────────────────────────────────────────────────────────────────╮
-- │ 026 — Fix: "Turnier per Code beitreten" war durch RLS blockiert           │
-- │                                                                            │
-- │ DiscoverScreen.joinByCode() machte 2 Dinge, die beide an RLS scheiterten: │
-- │  1. select tournaments where invite_code=… — tournaments_read lässt für    │
-- │     private/friends-Turniere nur Owner/Eingeladene lesen → Code unbekannt. │
-- │  2. upsert tournament_invites — invites_write verlangt Owner = auth.uid(), │
-- │     d.h. der Beitretende (nicht-Owner) wurde immer geblockt.               │
-- │                                                                            │
-- │ Fix: SECURITY-DEFINER-RPC redeem_invite_code(code) — der Code IST das      │
-- │ Geheimnis/die Berechtigung. Server löst den Code auf (umgeht read-RLS) und │
-- │ legt die eigene Invite-Zeile an (umgeht write-RLS), wodurch can_view_      │
-- │ tournament() den Beitretenden danach durchlässt. Gleiches Muster wie       │
-- │ join_open_tournament / approve_join_request.                               │
-- ╰──────────────────────────────────────────────────────────────────────────╯

create or replace function redeem_invite_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select id into t_id from tournaments
   where lower(invite_code) = lower(trim(p_code));
  if t_id is null then raise exception 'not_found'; end if;

  insert into tournament_invites (tournament_id, profile_id, invited_by)
  values (t_id, auth.uid(), auth.uid())
  on conflict (tournament_id, profile_id) do nothing;

  return t_id;
end $$;

grant execute on function redeem_invite_code(text) to authenticated;
