-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor · Scorecard-Fotos nur für den Uploader lesbar (2026-10-01)  │
-- │                                                                           │
-- │ Bisher: scu_read_own erlaubte jedem angemeldeten Nutzer, JEDES Objekt im  │
-- │ privaten Bucket scorecard-photos zu lesen (inkl. signierter URLs), sofern │
-- │ der Pfad bekannt war. Neu: nur der Uploader (owner_id = auth.uid()).      │
-- │ Die Auswertung (Edge-Function scorecard-ocr) nutzt den service_role-Key   │
-- │ und ist nicht betroffen. Upload (INSERT ... RETURNING) erfüllt die neue   │
-- │ Bedingung, weil Storage owner_id beim Upload auf den Aufrufer setzt.      │
-- │ Idempotent.                                                               │
-- ╰─────────────────────────────────────────────────────────────────────────╯

drop policy if exists scu_read_own on storage.objects;
create policy scu_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'scorecard-photos'
    and owner_id = (select auth.uid())::text
  );

-- ── Auflagen aus dem Fable-Review (2026-10-01) ──────────────────────────────
-- B) Uploads nur in der Pfadform <match-uuid>/<datei> (so baut der Client sie).
drop policy if exists scu_upload_own on storage.objects;
create policy scu_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'scorecard-photos'
    and (select auth.uid()) is not null
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- A) Die Edge-Function prüft vor dem Signieren, wem das Foto wirklich gehört.
create or replace function public.scorecard_photo_owner(p_path text)
returns text
language sql stable security definer set search_path = '' as $$
  select owner_id from storage.objects
   where bucket_id = 'scorecard-photos' and name = p_path
$$;
revoke all on function public.scorecard_photo_owner(text) from public, anon, authenticated;
grant execute on function public.scorecard_photo_owner(text) to service_role;

-- C) Bucket-Grenzen: nur Bilder, höchstens 15 MB.
update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'scorecard-photos';
