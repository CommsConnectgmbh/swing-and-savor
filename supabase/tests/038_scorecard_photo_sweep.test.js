// @vitest-environment node
// Spielt die Migrationen 022, 037 und 038 gegen ein echtes Postgres (PGlite)
// mit minimalen Supabase-Stubs (auth.uid, storage.objects, cron, net) ein und
// prüft Löschkandidaten, Client-Schreibschutz und Sweep-Lease.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const dir = dirname(fileURLToPath(import.meta.url))
const mig = (f) => readFileSync(join(dir, '..', 'migrations', f), 'utf8')

const VICTIM = '11111111-1111-4111-8111-111111111111'
const ATTACKER = '22222222-2222-4222-8222-222222222222'
const M_VICTIM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const M_ATTACKER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create schema cron; create schema net;
grant usage on schema auth, storage, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner_id text,
  created_at timestamptz not null default now(),
  unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule; select 1::bigint $$;
create function cron.unschedule(n text) returns boolean language sql as
  $$ delete from cron.job where jobname = n; select true $$;
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint
  language sql as $$ select 1::bigint $$;

create table public.tournaments (id uuid primary key default gen_random_uuid(), owner_id uuid);
create table public.matches (id uuid primary key, tournament_id uuid references public.tournaments(id));
create table public.private_config (key text primary key, value text not null);
`

const strip = (sql) => sql.replace(/^create extension[^;]*;$/gim, '')

let db
async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`) }
}
async function obj(name, owner, hoursOld = 0) {
  await db.query(
    `insert into storage.objects (bucket_id, name, owner_id, created_at)
     values ('scorecard-photos', $1, $2, now() - make_interval(hours => $3))`, [name, owner, hoursOld])
}
async function candidates() {
  const r = await db.query(`select * from public.scorecard_photo_sweep_candidates(null, 100) as name`)
  return r.rows.map((x) => x.name)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUBS)
  await db.exec(strip(mig('022_scorecard_ocr.sql')))
  await db.exec(strip(mig('037_scorecard_photos_owner_read.sql')))
  await db.exec(strip(mig('038_scorecard_photo_sweep.sql')))
  await db.query(`insert into auth.users values ($1), ($2)`, [VICTIM, ATTACKER])
  await db.query(`insert into public.tournaments (id, owner_id) values (gen_random_uuid(), $1)`, [VICTIM])
  await db.exec(`
    insert into public.tournaments (owner_id) values ('${ATTACKER}');
    insert into public.matches values ('${M_VICTIM}', (select id from public.tournaments where owner_id = '${VICTIM}'));
    insert into public.matches values ('${M_ATTACKER}', (select id from public.tournaments where owner_id = '${ATTACKER}'));
  `)
}, 60_000)

afterAll(async () => { await db?.close() })

describe('migration 038: sweep candidates', () => {
  it('ignores a foreign "done" row pointing at someone else\'s fresh photo', async () => {
    const path = `${M_VICTIM}/fresh.jpg`
    await obj(path, VICTIM, 0)
    // Altzeile/gefälschte Zeile (am Client-Schutz vorbei als Superuser angelegt)
    await db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'done')`, [M_ATTACKER, ATTACKER, path])
    await db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'failed')`, [M_VICTIM, ATTACKER, path])
    expect(await candidates()).not.toContain(path)
  })

  it('selects the uploader\'s own finished photo early and anything older than 24h', async () => {
    const own = `${M_VICTIM}/done.jpg`
    const old = `${M_VICTIM}/old.jpg`
    const young = `${M_VICTIM}/young.jpg`
    await obj(own, VICTIM, 0)
    await obj(old, VICTIM, 25)
    await obj(young, VICTIM, 1)
    await db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'done')`, [M_VICTIM, VICTIM, own])
    await db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'processing')`, [M_VICTIM, VICTIM, young])
    const c = await candidates()
    expect(c).toContain(own)
    expect(c).toContain(old)
    expect(c).not.toContain(young)
  })
})

describe('migration 038: client writes on scorecard_uploads', () => {
  it('rejects a row pointing at a photo the caller does not own', async () => {
    const path = `${M_VICTIM}/victim2.jpg`
    await obj(path, VICTIM, 0)
    await expect(as(ATTACKER, () => db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'done')`, [M_ATTACKER, ATTACKER, path]))).rejects.toThrow(/scorecard_upload_invalid_path/)
    // auch nicht mit "passendem" Match-Ordner des Opfers
    await expect(as(ATTACKER, () => db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path)
       values ($1, $2, $3)`, [M_ATTACKER, ATTACKER, `${M_ATTACKER}/missing.jpg`]))).rejects.toThrow(/scorecard_upload_invalid_path/)
  })

  it('accepts the app\'s own insert but forces ocr_status to pending', async () => {
    const path = `${M_ATTACKER}/own.jpg`
    await obj(path, ATTACKER, 0)
    await as(ATTACKER, () => db.query(
      `insert into public.scorecard_uploads (match_id, uploaded_by_user_id, storage_path, ocr_status)
       values ($1, $2, $3, 'done')`, [M_ATTACKER, ATTACKER, path]))
    const r = await db.query(`select ocr_status from public.scorecard_uploads where storage_path = $1`, [path])
    expect(r.rows[0].ocr_status).toBe('pending')
  })

  it('lets clients change only applied_at / applied_by_user_id', async () => {
    const path = `${M_ATTACKER}/own.jpg`
    await expect(as(ATTACKER, () => db.query(
      `update public.scorecard_uploads set ocr_status = 'done' where storage_path = $1`, [path]))).rejects.toThrow()
    await expect(as(ATTACKER, () => db.query(
      `update public.scorecard_uploads set storage_path = $2 where storage_path = $1`, [path, `${M_VICTIM}/fresh.jpg`]))).rejects.toThrow()
    await as(ATTACKER, () => db.query(
      `update public.scorecard_uploads set applied_at = now(), applied_by_user_id = $2 where storage_path = $1`, [path, ATTACKER]))
    const r = await db.query(`select applied_at, ocr_status from public.scorecard_uploads where storage_path = $1`, [path])
    expect(r.rows[0].applied_at).not.toBeNull()
    expect(r.rows[0].ocr_status).toBe('pending')
  })
})

describe('migration 038: sweep state', () => {
  it('hands out one lease at a time and stores the cursor', async () => {
    const first = await db.query(`select * from public.scorecard_photo_sweep_begin(120)`)
    expect(first.rows).toEqual([{ cursor_name: null }])
    const second = await db.query(`select * from public.scorecard_photo_sweep_begin(120)`)
    expect(second.rows).toEqual([])
    await db.query(`select public.scorecard_photo_sweep_save('m/5.jpg')`)
    const third = await db.query(`select * from public.scorecard_photo_sweep_begin(120)`)
    expect(third.rows).toEqual([{ cursor_name: 'm/5.jpg' }])
  })

  it('schedules the cron job', async () => {
    const r = await db.query(`select schedule from cron.job where jobname = 'scorecard-photo-sweep'`)
    expect(r.rows).toEqual([{ schedule: '17 * * * *' }])
  })
})
