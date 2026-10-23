-- Security hardening (audit 2026-10-19, validated locally against the live schema).
--
-- 1. profiles: ranking and system columns are server-side only.
-- 2. courses: direct updates only by the creator or the admin, limited columns;
--    community edits go through the audited apply_course_edit RPC.
-- 3. join_open_tournament honours tournament visibility.
-- 4. Public storage buckets: size and image-only MIME limits, uploads bound to
--    the uploader's own folder / tournament / match.
-- 5. Durable rate limit for public Edge Functions (osm-seed-courses,
--    import-courses, subscribe-newsletter).
-- 6. delete_account_data(): complete, fail-closed account erasure used by the
--    delete-account Edge Function.

-- ─── 1. profiles ─────────────────────────────────────────────────────────────
-- RLS (profiles_update_self) binds the row; column privileges bind the columns.
-- elo_rating / wins / games_played are only written by the SECURITY DEFINER
-- update_elo_for_challenge(); is_pro / pro_until only by the Stripe webhook
-- (service_role); ref_code by the BEFORE INSERT trigger.
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant insert (id, handle, display_name, avatar_url, hcp, home_club, home_course_id)
  on table public.profiles to authenticated;
grant update (display_name, avatar_url, hcp, home_club, home_course_id, updated_at)
  on table public.profiles to authenticated;

-- ─── 2. courses ──────────────────────────────────────────────────────────────
alter table public.courses alter column created_by set default auth.uid();

drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses
  for insert to authenticated
  with check (created_by = (select auth.uid()) and source = 'user');

drop policy if exists courses_update on public.courses;
create policy courses_update_owner_or_admin on public.courses
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or ((select auth.jwt()) ->> 'email') = 'rainer.roloff@comms-connect.de'
  )
  with check (
    created_by = (select auth.uid())
    or ((select auth.jwt()) ->> 'email') = 'rainer.roloff@comms-connect.de'
  );

revoke insert, update, delete on table public.courses from anon, authenticated;
grant insert (source, name, city, country, postal_code, lat, lng, hole_pars,
              hole_handicaps, total_par, num_holes, notes, website)
  on table public.courses to authenticated;
grant update (name, city, country, postal_code, lat, lng, hole_pars,
              hole_handicaps, total_par, num_holes, notes, website)
  on table public.courses to authenticated;

-- Audited community edit path: login required, plausible values, keeps total_par
-- in sync. Signature unchanged.
create or replace function public.apply_course_edit(
  p_course_id uuid,
  p_hole_pars integer[],
  p_hole_handicaps integer[],
  p_source_match_id uuid default null
) returns public.courses
language plpgsql security definer set search_path = public as $$
declare
  result courses;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_hole_pars is not null and (
       cardinality(p_hole_pars) > 18
       or exists (select 1 from unnest(p_hole_pars) x where x is null or x < 1 or x > 10)) then
    raise exception 'invalid_hole_pars';
  end if;
  if p_hole_handicaps is not null and (
       cardinality(p_hole_handicaps) > 18
       or exists (select 1 from unnest(p_hole_handicaps) x where x is null or x < 0 or x > 18)) then
    raise exception 'invalid_hole_handicaps';
  end if;
  if not exists (select 1 from courses where id = p_course_id) then
    raise exception 'not_found';
  end if;

  insert into course_edits (course_id, edited_by, hole_pars, hole_handicaps, source_match_id)
  values (p_course_id, auth.uid(), p_hole_pars, p_hole_handicaps, p_source_match_id);

  update courses
  set hole_pars      = coalesce(p_hole_pars, hole_pars),
      hole_handicaps = coalesce(p_hole_handicaps, hole_handicaps),
      total_par      = case when cardinality(coalesce(p_hole_pars, '{}')) > 0
                            then (select sum(x) from unnest(p_hole_pars) x)::int
                            else total_par end,
      last_edited_by = auth.uid(),
      last_edited_at = now(),
      contributor_count = contributor_count + 1
  where id = p_course_id
  returning * into result;

  return result;
end $$;
revoke all on function public.apply_course_edit(uuid, integer[], integer[], uuid) from public, anon;
grant execute on function public.apply_course_edit(uuid, integer[], integer[], uuid) to authenticated, service_role;

-- ─── 3. join_open_tournament: same visibility rule as joinreq_insert_self ─────
create or replace function public.join_open_tournament(t_id uuid, accepted boolean default true)
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
  -- Only an explicit TRUE admits; NULL (e.g. a missing owner) is a denial.
  if (
       t.visibility = 'public'
       or t.owner_id = auth.uid()
       or (t.visibility = 'friends' and t.owner_id is not null and are_friends(auth.uid(), t.owner_id))
       or exists (select 1 from tournament_invites i where i.tournament_id = t.id and i.profile_id = auth.uid())
     ) is not true then
    -- Same error as a missing tournament: no existence oracle for private cups.
    raise exception 'not_found';
  end if;

  select * into prof from profiles where id = auth.uid();

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
revoke all on function public.join_open_tournament(uuid, boolean) from public, anon;
grant execute on function public.join_open_tournament(uuid, boolean) to authenticated, service_role;

-- ─── 4. Storage: public buckets ──────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
 where id in ('match-photos', 'cup-covers');
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
 where id = 'sponsor-logos';
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
 where id = 'savor-images';

-- Path checks (SECURITY DEFINER: they read matches/players/tournaments).
-- match-photos: "<match_id>/<file>" for match participants and the cup owner,
--               "cups/<tournament_id>/<file>" for the tournament owner.
create or replace function public.storage_match_photo_upload_ok(p_name text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f text[] := storage.foldername(p_name);
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if auth.uid() is null then return false; end if;
  if cardinality(f) = 1 and f[1] ~ uuid_re then
    -- Same writers as matches.photo_url: participants (matches_update_participant)
    -- and the tournament owner (matches_write).
    return is_match_participant(f[1]::uuid)
        or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
                    where m.id = f[1]::uuid and t.owner_id = auth.uid());
  end if;
  if cardinality(f) = 2 and f[1] = 'cups' and f[2] ~ uuid_re then
    return exists (select 1 from tournaments t where t.id = f[2]::uuid and t.owner_id = auth.uid());
  end if;
  return false;
end $$;

-- cup-covers: "<tournament_id>/<file>" for the tournament owner.
create or replace function public.storage_cup_cover_upload_ok(p_name text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f text[] := storage.foldername(p_name);
begin
  if auth.uid() is null then return false; end if;
  if cardinality(f) = 1
     and f[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (select 1 from tournaments t where t.id = f[1]::uuid and t.owner_id = auth.uid());
  end if;
  return false;
end $$;

revoke all on function public.storage_match_photo_upload_ok(text) from public, anon;
revoke all on function public.storage_cup_cover_upload_ok(text) from public, anon;
grant execute on function public.storage_match_photo_upload_ok(text) to authenticated, service_role;
grant execute on function public.storage_cup_cover_upload_ok(text) to authenticated, service_role;

drop policy if exists match_photos_write on storage.objects;
create policy match_photos_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'match-photos' and public.storage_match_photo_upload_ok(name));

drop policy if exists cup_covers_insert_owner on storage.objects;
create policy cup_covers_insert_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cup-covers' and public.storage_cup_cover_upload_ok(name));

drop policy if exists sponsor_logos_insert_auth on storage.objects;
create policy sponsor_logos_insert_auth on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sponsor-logos'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ─── 5. Durable rate limit for public Edge Functions ────────────────────────
-- Keys are "<bucket>:<value>". Limits are fixed here per bucket, never passed
-- in by the caller. Same locking pattern as reviewer_bypass_register_attempt.
create table if not exists public.edge_rate_limit_events (
  key         text        not null,
  occurred_at timestamptz not null default now()
);
create index if not exists edge_rate_limit_events_key_time
  on public.edge_rate_limit_events (key, occurred_at);
create index if not exists edge_rate_limit_events_time
  on public.edge_rate_limit_events (occurred_at);
alter table public.edge_rate_limit_events enable row level security;
revoke all on table public.edge_rate_limit_events from public, anon, authenticated;

create or replace function public.edge_rate_limit_register(p_keys text[])
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  ks   text[];
  k    text;
  lim  integer;
  win  interval;
begin
  select coalesce(array_agg(distinct x order by x), '{}')
    into ks
    from unnest(coalesce(p_keys, '{}'::text[])) as x
   where x is not null;
  if cardinality(ks) = 0 or cardinality(ks) > 4 then
    raise exception 'edge_rate_limit_register: invalid keys';
  end if;
  foreach k in array ks loop
    if length(k) > 300 or k !~ '^(osm-seed|import-courses|newsletter-ip|newsletter-email):.+$' then
      raise exception 'edge_rate_limit_register: invalid key';
    end if;
  end loop;

  foreach k in array ks loop
    perform pg_advisory_xact_lock(hashtextextended('edge_rate_limit:' || k, 0));
  end loop;

  delete from public.edge_rate_limit_events where occurred_at < clock_timestamp() - interval '1 day';

  foreach k in array ks loop
    case split_part(k, ':', 1)
      when 'osm-seed'         then lim := 5;  win := interval '1 hour';
      when 'import-courses'   then lim := 30; win := interval '1 hour';
      when 'newsletter-ip'    then lim := 10; win := interval '1 hour';
      when 'newsletter-email' then lim := 3;  win := interval '1 day';
    end case;
    if (select count(*) from public.edge_rate_limit_events
         where key = k and occurred_at > clock_timestamp() - win) >= lim then
      return false;
    end if;
  end loop;

  insert into public.edge_rate_limit_events (key, occurred_at)
  select x, clock_timestamp() from unnest(ks) as x;
  return true;
end $$;
revoke all on function public.edge_rate_limit_register(text[]) from public, anon, authenticated;
grant execute on function public.edge_rate_limit_register(text[]) to service_role;

-- ─── 6. Account erasure ──────────────────────────────────────────────────────
-- Runs in one transaction (fail-closed). Returns the storage objects the Edge
-- Function must remove through the Storage API before deleting the auth user.
-- Kept on purpose (legal retention, no free-text PII beyond the record itself):
-- widerruf_requests (proof of withdrawal, § 355 BGB / limitation period) and
-- payment rows (premium_purchases, tournament_promotions, pro_entitlements are
-- cascaded or nulled by their FKs; Stripe holds the tax record).
create or replace function public.delete_account_data(p_uid uuid, p_email text)
returns table (bucket text, object_name text)
language plpgsql volatile security definer set search_path = public, storage as $$
declare
  anon_name constant text := 'Gelöschter Spieler';
begin
  if p_uid is null then raise exception 'delete_account_data: uid required'; end if;

  -- Display names copied into other people's cups, rounds and scorecards.
  update players set name = anon_name where profile_id = p_uid;
  update casual_round_players set display_name = anon_name where profile_id = p_uid;
  update awards set recipient_name = anon_name where recipient_profile_id = p_uid;
  update tournament_join_requests set display_name = anon_name, message = null where profile_id = p_uid;
  update match_signatures set signer_label = anon_name, device_label = null where signer_user_id = p_uid;

  -- Rows without a cascading FK.
  delete from scorecard_uploads where uploaded_by_user_id = p_uid;
  delete from client_debug where user_id = p_uid;
  if p_email is not null and length(trim(p_email)) > 0 then
    delete from newsletter_subscribers where lower(email) = lower(trim(p_email));
  end if;
  delete from challenges where challenger_id = p_uid or opponent_id = p_uid;
  delete from friendships where user_a = p_uid or user_b = p_uid;
  delete from tournaments where owner_id = p_uid;

  -- Profile last: cascades conversations, messages, reactions, comments,
  -- push subscriptions, invites, join requests, blocks, referrals, ...
  delete from profiles where id = p_uid;

  -- Every object the user uploaded, in any bucket (avatars, photos, logos,
  -- scorecard photos). The caller deletes them via the Storage API.
  return query
    select o.bucket_id::text, o.name::text
      from storage.objects o
     where o.owner_id = p_uid::text or o.owner = p_uid;
end $$;
revoke all on function public.delete_account_data(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid, text) to service_role;
