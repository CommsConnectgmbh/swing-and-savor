-- PostGIS aus public nach extensions verlegen.
-- Hintergrund: Supabase-Advisor meldet public.spatial_ref_sys als "rls_disabled_in_public"
-- (anon/authenticated duerfen dort schreiben und leeren). Die Tabelle gehoert supabase_admin,
-- RLS und REVOKE sind fuer postgres nicht moeglich, postgis kennt kein SET SCHEMA.
-- Also Erweiterung neu im Schema extensions anlegen und die abhaengigen Objekte nachziehen.
-- courses.geom wird vollstaendig aus lat/lng abgeleitet (Trigger trg_courses_geom).

set local search_path = public, extensions;
set local lock_timeout = '5s';

-- Schreibsperre vor Sicherung/Neuberechnung, damit keine parallele Aenderung verloren geht.
lock table public.courses in access exclusive mode;

drop extension postgis cascade;   -- entfernt courses.geom, courses_geom_idx und die Schreibsperr-Trigger auf spatial_ref_sys
create extension postgis with schema extensions;

-- Funktionen mit festem search_path muessen die PostGIS-Funktionen weiter finden.
alter function public.courses_near(double precision, double precision, integer, integer)
  set search_path = public, extensions;
alter function public.courses_set_geom()
  set search_path = public, extensions;
-- (vor dem Update, weil trg_courses_geom dabei feuert)

alter table public.courses add column geom extensions.geography(Point, 4326);
update public.courses
   set geom = extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
 where lat is not null and lng is not null;
create index courses_geom_idx on public.courses using gist (geom);

-- Die Schreibsperre fuer spatial_ref_sys (Bericht 2026-06-02) ist ueberholt: die Tabelle liegt jetzt
-- in extensions, das ueber die API nicht erreichbar ist. Die Trigger hat die Kaskade entfernt.
drop function public.deny_write_spatial_ref_sys();
