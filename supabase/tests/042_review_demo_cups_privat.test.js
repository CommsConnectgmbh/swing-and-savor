// @vitest-environment node
// Spielt Migration 042 gegen ein echtes Postgres (PGlite) mit minimalen Tabellen ein:
// Demo-Turniere der Review-Konten werden privat, Profigolfer-Namen fiktiv, fremde Daten
// bleiben unberuehrt, bei unerwartetem Zustand bricht die Migration ohne Aenderung ab.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const dir = dirname(fileURLToPath(import.meta.url))
const MIG = readFileSync(join(dir, '..', 'migrations', '042_review_demo_cups_privat.sql'), 'utf8')

const APPLE = '3db4c0fd-28bf-4c60-b680-7c9056e49e4b'
const PLAY = 'c93c2b02-95f0-4cb3-9b76-4d9df0a6bd46'
const OTHER = '33333333-3333-4333-8333-333333333333'
const T1 = 'd5f0c33c-bdfb-47a0-a219-842db065aedd'
const T2 = '9ef0ca0a-4023-4186-a489-a68af0791c46'
const T3 = '652b6cd4-5f8d-4c8a-801b-899f57e2c3ab'
const TX = '44444444-4444-4444-8444-444444444444'

const SCHEMA = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create table public.profiles (id uuid primary key, handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'), display_name text);
create table public.tournaments (id uuid primary key, name text, owner_id uuid, visibility text);
create table public.players (id serial primary key, tournament_id uuid, name text, profile_id uuid);
create table public.matches (id serial primary key, tournament_id uuid, visibility text
  check (visibility is null or visibility in ('public','friends','private')));
`
const SEED = `
insert into auth.users values ('${APPLE}','apple-review@swingandsavor.at'),('${PLAY}','play-review@swingandsavor.at'),('${OTHER}','x@example.org');
insert into public.profiles values ('${APPLE}','tigerw','Tiger W.'),('${PLAY}','playreviewer','Play Reviewer'),('${OTHER}','golfer','Tiger W.');
insert into public.tournaments values
  ('${T1}','🍃 Apple Review Demo Cup','${APPLE}','public'),
  ('${T2}','🍃 Apple Review Demo Cup','${PLAY}','public'),
  ('${T3}','Spring Cup 2026','${APPLE}','public'),
  ('${TX}','Fremder Cup','${OTHER}','public');
insert into public.players (tournament_id,name,profile_id) values
  ('${T1}','Tiger W.','${APPLE}'),('${T1}','Lena Eagle',null),
  ('${T3}','Tiger W.',null),('${T3}','Phil M.',null),('${T3}','Rory M.',null),('${T3}','Jordan S.',null),
  ('${TX}','Tiger W.',null);
insert into public.matches (tournament_id,visibility) values ('${T1}','public'),('${T3}',null),('${TX}','public');
`
async function db() {
  const pg = new PGlite()
  await pg.exec(SCHEMA)
  await pg.exec(SEED)
  return pg
}
const rows = async (pg, q) => (await pg.query(q)).rows

describe('Migration 042: Review-Demo-Cups privat, fiktive Namen', { timeout: 30000 }, () => {
  it('stellt genau die drei Demo-Turniere privat und laesst fremde unberuehrt', async () => {
    const pg = await db()
    await pg.exec(MIG)
    const t = await rows(pg, 'select id, visibility from public.tournaments order by id')
    const vis = Object.fromEntries(t.map((r) => [r.id, r.visibility]))
    expect(vis[T1]).toBe('private'); expect(vis[T2]).toBe('private'); expect(vis[T3]).toBe('private')
    expect(vis[TX]).toBe('public')
    const m = await rows(pg, `select tournament_id, visibility from public.matches order by id`)
    expect(m).toEqual([
      { tournament_id: T1, visibility: null },
      { tournament_id: T3, visibility: null },
      { tournament_id: TX, visibility: 'public' },
    ])
  })

  it('ersetzt Profigolfer-Namen nur in den Demo-Turnieren und im Review-Profil', async () => {
    const pg = await db()
    await pg.exec(MIG)
    const p = await rows(pg, 'select tournament_id, name from public.players order by id')
    expect(p.map((r) => r.name)).toEqual(['Max K.', 'Lena Eagle', 'Max K.', 'Ben L.', 'Luca R.', 'Jonas F.', 'Tiger W.'])
    const prof = await rows(pg, 'select id, handle, display_name from public.profiles order by handle')
    expect(prof).toContainEqual({ id: APPLE, handle: 'maxk', display_name: 'Max K.' })
    expect(prof).toContainEqual({ id: PLAY, handle: 'playreviewer', display_name: 'Play Reviewer' })
    expect(prof).toContainEqual({ id: OTHER, handle: 'golfer', display_name: 'Tiger W.' })
  })

  it('ist idempotent (zweiter Lauf aendert nichts und bricht nicht ab)', async () => {
    const pg = await db()
    await pg.exec(MIG)
    const vorher = await rows(pg, 'select * from public.players order by id')
    await pg.exec(MIG)
    expect(await rows(pg, 'select * from public.players order by id')).toEqual(vorher)
  })

  it('bricht ohne Aenderung ab, wenn ein Demo-Turnier fehlt oder fremd ist', async () => {
    const pg = await db()
    await pg.exec(`update public.tournaments set owner_id='${OTHER}' where id='${T3}'`)
    await expect(pg.exec(MIG)).rejects.toThrow(/Demo-Turniere nicht wie erwartet/)
    const t = await rows(pg, `select visibility from public.tournaments where id='${T1}'`)
    expect(t[0].visibility).toBe('public')
  })

  it('bricht ab, wenn der Handle maxk schon vergeben ist', async () => {
    const pg = await db()
    await pg.exec(`update public.profiles set handle='maxk' where id='${OTHER}'`)
    await expect(pg.exec(MIG)).rejects.toThrow(/Handle maxk bereits vergeben/)
    const p = await rows(pg, `select name from public.players where tournament_id='${T3}' order by id`)
    expect(p[0].name).toBe('Tiger W.')
  })
})
