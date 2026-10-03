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
-- │    Fehlt die Konfiguration, passiert nichts außer einer Warnung.          │
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

-- ── 3. Zeitplan ─────────────────────────────────────────────────────────────
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
