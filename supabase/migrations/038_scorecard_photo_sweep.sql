-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor · Scorecard-Fotos: Löschnachweis + geplanter Sweep          │
-- │ (2026-10-03)                                                              │
-- │                                                                           │
-- │ Scorekarten zeigen Namen und Handicaps; das Foto darf nur so lange        │
-- │ liegen, wie die Auswertung es braucht.                                    │
-- │                                                                           │
-- │ 1. scorecard_uploads.photo_deleted_at wird nur bei bestätigtem Löschen    │
-- │    gesetzt, photo_delete_error hält den Grund eines Fehlschlags fest.     │
-- │ 2. Hilfsfunktionen (nur service_role) für die Edge-Functions:             │
-- │    scorecard_photos_existing, scorecard_photo_sweep_candidates,           │
-- │    scorecard_photo_reconcile. Sie LESEN storage.objects; gelöscht wird    │
-- │    ausschließlich über die Storage-API (Edge-Function), nie per SQL.      │
-- │ 3. pg_cron ruft stündlich die Edge-Function scorecard-photo-sweep über    │
-- │    pg_net auf (URL + Secret aus private_config, wie discord_notify).      │
-- │    Fehlt die Konfiguration, passiert nichts außer einer Warnung. Der      │
-- │    Fortschritt (Keyset-Cursor) wird mit Lease gespeichert, damit ein      │
-- │    Zeitabbruch nicht immer wieder vorne beginnt.                          │
-- │ 4. Client-Schreibrechte auf scorecard_uploads eingeschränkt: Pfad, Match  │
-- │    und Uploader werden bei der Anlage gegen das Storage-Objekt geprüft;   │
-- │    OCR-Status/-Ergebnis und Löschnachweis schreibt nur der Server; Clients│
-- │    dürfen danach nur applied_at/applied_by_user_id ändern.                │
-- │ Idempotent.                                                               │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- ── 1. Löschnachweis ────────────────────────────────────────────────────────
alter table public.scorecard_uploads
  add column if not exists photo_deleted_at   timestamptz,
  add column if not exists photo_delete_error text;

create index if not exists scu_storage_path_idx on public.scorecard_uploads (storage_path);
create index if not exists scu_photo_pending_idx on public.scorecard_uploads (created_at)
  where photo_deleted_at is null;

-- ── 2. Hilfsfunktionen ──────────────────────────────────────────────────────
-- Welche der übergebenen Pfade liegen noch im Bucket? (Bestätigung nach remove)
create or replace function public.scorecard_photos_existing(p_paths text[])
returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
   where o.bucket_id = 'scorecard-photos'
     and o.name = any(p_paths)
$$;

-- Löschkandidaten, seitenweise nach Name (Keyset): älter als 24 Stunden oder
-- Auswertung abgeschlossen (done/failed). Laufende Auswertungen jünger als
-- 24 Stunden bleiben unberührt. Objekte ohne Upload-Zeile (Abbruch zwischen
-- Upload und Insert) fallen über das Alter mit hinein.
-- Der vorzeitige Zweig zählt eine Upload-Zeile nur, wenn sie wirklich zu dem
-- Objekt gehört: Storage setzt owner_id beim Upload selbst (nicht fälschbar),
-- er muss dem Uploader der Zeile entsprechen, und der Pfad muss im Match-
-- Ordner der Zeile liegen. Eine fremde Zeile kann so kein frisches Foto eines
-- anderen Nutzers vorzeitig zur Löschung bringen (gilt auch für Altzeilen).
create or replace function public.scorecard_photo_sweep_candidates(
  p_after text default null,
  p_limit int default 500
)
returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
   where o.bucket_id = 'scorecard-photos'
     and o.name > coalesce(p_after, '')
     and (
       o.created_at < now() - interval '24 hours'
       or exists (
         select 1 from public.scorecard_uploads u
          where u.storage_path = o.name
            and u.ocr_status in ('done', 'failed')
            and u.uploaded_by_user_id is not null
            and o.owner_id = u.uploaded_by_user_id::text
            and starts_with(o.name, u.match_id::text || '/')
       )
     )
   order by o.name
   limit greatest(1, least(coalesce(p_limit, 500), 1000))
$$;

-- Zeilen, deren Foto nachweislich nicht mehr im Bucket liegt, als gelöscht
-- markieren (Altbestand vor dieser Migration und Fälle, in denen das Setzen
-- von photo_deleted_at nach dem Löschen scheiterte). Liefert die Anzahl.
create or replace function public.scorecard_photo_reconcile()
returns integer
language sql security definer set search_path = '' as $$
  with upd as (
    update public.scorecard_uploads u
       set photo_deleted_at = now(), photo_delete_error = null
     where u.photo_deleted_at is null
       and not exists (
         select 1 from storage.objects o
          where o.bucket_id = 'scorecard-photos' and o.name = u.storage_path
       )
    returning 1
  )
  select count(*)::int from upd
$$;

revoke all on function public.scorecard_photos_existing(text[])               from public, anon, authenticated;
revoke all on function public.scorecard_photo_sweep_candidates(text, int)     from public, anon, authenticated;
revoke all on function public.scorecard_photo_reconcile()                     from public, anon, authenticated;
grant execute on function public.scorecard_photos_existing(text[])            to service_role;
grant execute on function public.scorecard_photo_sweep_candidates(text, int)  to service_role;
grant execute on function public.scorecard_photo_reconcile()                  to service_role;

-- Altbestand einmal abgleichen.
select public.scorecard_photo_reconcile();

-- ── 3. Fortschritt des Sweeps (Cursor + Lease) ───────────────────────────────
create table if not exists public.scorecard_photo_sweep_state (
  id           int primary key default 1 check (id = 1),
  cursor_name  text,
  lease_until  timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.scorecard_photo_sweep_state enable row level security;
-- keine Policies: nur service_role (Edge-Function) und Definer-Funktionen
revoke all on public.scorecard_photo_sweep_state from anon, authenticated;
insert into public.scorecard_photo_sweep_state (id) values (1) on conflict (id) do nothing;

-- Lease holen (atomar, damit sich zwei Läufe nicht überlappen) und den
-- gespeicherten Cursor liefern. Ohne Lease: keine Zeile.
create or replace function public.scorecard_photo_sweep_begin(p_lease_seconds int default 120)
returns table (cursor_name text)
language sql security definer set search_path = '' as $$
  update public.scorecard_photo_sweep_state s
     set lease_until = now() + make_interval(secs => greatest(10, coalesce(p_lease_seconds, 120))),
         updated_at  = now()
   where s.id = 1
     and (s.lease_until is null or s.lease_until < now())
  returning s.cursor_name
$$;

-- Cursor speichern (null = Ende erreicht, nächster Lauf beginnt vorne) und
-- Lease freigeben.
create or replace function public.scorecard_photo_sweep_save(p_cursor text)
returns void
language sql security definer set search_path = '' as $$
  update public.scorecard_photo_sweep_state
     set cursor_name = p_cursor, lease_until = null, updated_at = now()
   where id = 1
$$;

revoke all on function public.scorecard_photo_sweep_begin(int)  from public, anon, authenticated;
revoke all on function public.scorecard_photo_sweep_save(text)  from public, anon, authenticated;
grant execute on function public.scorecard_photo_sweep_begin(int) to service_role;
grant execute on function public.scorecard_photo_sweep_save(text) to service_role;

-- ── 4. Client-Schreibrechte auf scorecard_uploads ───────────────────────────
-- Die App legt Zeilen an mit match_id, uploaded_by_user_id, storage_path,
-- ocr_status='pending' und setzt später nur applied_at/applied_by_user_id
-- (ScorecardSheet.jsx). Alles andere schreibt die Edge-Function (service_role).
create or replace function public.scu_guard_client_write()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- nur Data-API-Clients einschränken; service_role/postgres unverändert
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.ocr_status         := 'pending';
    new.ocr_result         := null;
    new.ocr_error          := null;
    new.applied_at         := null;
    new.applied_by_user_id := null;
    new.photo_deleted_at   := null;
    new.photo_delete_error := null;
    if new.uploaded_by_user_id is distinct from auth.uid()
       or new.storage_path is null
       or not starts_with(new.storage_path, new.match_id::text || '/')
       or not exists (
         select 1 from storage.objects o
          where o.bucket_id = 'scorecard-photos'
            and o.name = new.storage_path
            and o.owner_id = auth.uid()::text
       ) then
      raise exception 'scorecard_upload_invalid_path' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: nur applied_at/applied_by_user_id
  if (to_jsonb(new) - 'applied_at' - 'applied_by_user_id')
     is distinct from (to_jsonb(old) - 'applied_at' - 'applied_by_user_id') then
    raise exception 'scorecard_upload_readonly_columns' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists scu_guard_client_write on public.scorecard_uploads;
create trigger scu_guard_client_write
  before insert or update on public.scorecard_uploads
  for each row execute function public.scu_guard_client_write();

-- zusätzlich auf Rechteebene: Updates nur auf die zwei Anwendungsfelder
revoke update on public.scorecard_uploads from anon, authenticated;
grant update (applied_at, applied_by_user_id) on public.scorecard_uploads to authenticated;

-- ── 5. Zeitplan ─────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.call_scorecard_photo_sweep()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from private_config where key = 'scorecard_sweep_url';
  select value into v_secret from private_config where key = 'scorecard_sweep_secret';
  if v_url is null or v_secret is null then
    raise warning 'scorecard_sweep config missing';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.call_scorecard_photo_sweep() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'scorecard-photo-sweep') then
    perform cron.unschedule('scorecard-photo-sweep');
  end if;
end $$;
select cron.schedule('scorecard-photo-sweep', '17 * * * *', $cron$select public.call_scorecard_photo_sweep()$cron$);
