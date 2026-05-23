-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Analoge Scorekarte via Foto-OCR                        │
-- │ Speichert hochgeladene Karten, OCR-Status, geparste Werte.             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists scorecard_uploads (
  id                   uuid primary key default gen_random_uuid(),
  match_id             uuid not null references matches(id) on delete cascade,
  uploaded_by_user_id  uuid references auth.users(id) on delete set null,
  storage_path         text not null,
  width                int,
  height               int,
  ocr_status           text not null default 'pending'
                              check (ocr_status in ('pending','processing','done','failed')),
  ocr_provider         text default 'openai',
  ocr_result           jsonb,
  ocr_error            text,
  applied_at           timestamptz,
  applied_by_user_id   uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists scu_match_idx  on scorecard_uploads (match_id);
create index if not exists scu_status_idx on scorecard_uploads (ocr_status);

alter table scorecard_uploads enable row level security;

drop policy if exists scu_read on scorecard_uploads;
create policy scu_read on scorecard_uploads for select using (
  uploaded_by_user_id = auth.uid()
  or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
             where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null))
);

drop policy if exists scu_insert on scorecard_uploads;
create policy scu_insert on scorecard_uploads for insert with check (
  uploaded_by_user_id = auth.uid()
  and exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
              where m.id = match_id and (t.owner_id = auth.uid() or t.owner_id is null))
);

drop policy if exists scu_update on scorecard_uploads;
create policy scu_update on scorecard_uploads for update using (
  uploaded_by_user_id = auth.uid()
  or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
             where m.id = match_id and t.owner_id = auth.uid())
);

-- privater Bucket (Service-Role schreibt das OCR-Ergebnis)
insert into storage.buckets (id, name, public)
  values ('scorecard-photos', 'scorecard-photos', false)
  on conflict (id) do nothing;

-- Storage RLS: authenticated darf in eigenen match-Pfad uploaden
do $$ begin
  if exists (select 1 from pg_policies where schemaname='storage' and policyname='scu_upload_own') then
    drop policy "scu_upload_own" on storage.objects;
  end if;
end $$;
create policy "scu_upload_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scorecard-photos'
    and (auth.uid() is not null)
  );

do $$ begin
  if exists (select 1 from pg_policies where schemaname='storage' and policyname='scu_read_own') then
    drop policy "scu_read_own" on storage.objects;
  end if;
end $$;
create policy "scu_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'scorecard-photos');
