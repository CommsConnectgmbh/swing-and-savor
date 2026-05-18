-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Turnier-Cover                                           │
-- │ Optionales Cover-Bild pro Turnier, public-read aus match-photos Bucket  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table tournaments
  add column if not exists cover_url text;

comment on column tournaments.cover_url is
  'Optionales Cover-Foto fuer das Turnier, public-read aus dem match-photos Bucket (Prefix cups/{tournament_id}/).';
