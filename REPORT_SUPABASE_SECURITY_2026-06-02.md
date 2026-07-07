# Supabase Security-Advisor Remediation — swing-and-savor

**Projekt:** `rcqichlyllhwougopfkg` (Org `yersdrtqxjabeevqiefe`) · **Datum:** 2026-06-02
**Ausgangslage:** 98 Advisor-Lints (1 CRITICAL aus der Supabase-Warnmail) · **Ergebnis:** ~37 Lints, alle übrigen sind notwendig, bewusst gelassen oder plattformseitig nicht fixbar.

## Behoben

| Finding | Level | n | Fix |
|---|---|---|---|
| `security_definer_view` | ERROR | 4 | `security_invoker = on` auf leaderboard_global, match_player_locked, match_social_counts, rivalries. Schließt zusätzlich ein echtes RLS-Leak: rivalries/match_social_counts gaben vorher Daten aus privaten Tournaments preis. |
| `function_search_path_mutable` | WARN | 18 | Alle postgres-owned Funktionen ohne pinned path auf `search_path = public` gesetzt (non-breaking, postgis/pg_trgm liegen in public). |
| `auth_leaked_password_protection` | WARN | 1 | `password_hibp_enabled = true` via Management-API. |
| `public_bucket_allows_listing` | WARN | 5 | Breite SELECT-(list-)Policies auf avatars, cup-covers, match-photos, savor-images, sponsor-logos gedroppt. App nutzt nur upload/remove/getPublicUrl (im Code verifiziert, kein `.list()`), Public-Downloads laufen via CDN weiter. |
| `*_security_definer_function_executable` | WARN | 22 | EXECUTE entzogen: 8 Trigger-Funktionen + 3 interne secdef-Helper (call_send_push, compute_match_winner, update_elo_for_challenge) komplett; 11 login-pflichtige RPCs für `anon`/PUBLIC (authenticated behält Zugriff). |

## spatial_ref_sys (die CRITICAL-Mail)

PostGIS-Extensionstabelle, owner `supabase_admin` → RLS nicht aktivierbar und Grants nicht widerrufbar durch die `postgres`-Rolle (gilt auch für den Dashboard-SQL-Editor). `anon` hatte vollen Schreibzugriff (INSERT/UPDATE/DELETE, per `SET ROLE anon` bestätigt) → hätte die 8.500 EPSG-Definitionen zerstören und ST_Transform/`courses.geom` brechen können.

**Mitigation:** Guard-Trigger `deny_write_spatial_ref_sys` macht die Tabelle read-only für App-Rollen (SELECT/ST_Transform unberührt, platform/owner-Rollen für PostGIS-Upgrades erlaubt). Der Advisor-Eintrag bleibt rot (nur via RLS clearbar, was unmöglich ist) — im Security-Advisor als bekanntes PostGIS-Limit acknowledgen oder bei Supabase-Support eskalieren. Das eigentliche Exploit ist zu.

## Bewusst gelassen

- `rls_disabled_in_public` × 1 (spatial_ref_sys) — s.o.
- `extension_in_public` × 2 (postgis, pg_trgm) — ownership-blockiert; Verschieben würde den search_path-Fix brechen. Standard-Supabase-Setup.
- `rls_enabled_no_policy` × 5 INFO (app_config, newsletter_subscribers, private_config, tournament_secrets, widerruf_requests) — RLS-an-ohne-Policy = vollständig gesperrt (nur service_role). Policy hinzufügen würde ÖFFNEN. Korrekt so.
- `*_security_definer_function_executable` (Rest) — RLS-Helper (can_view_*, casual_round_visible, is_community_member) müssen für Policies executable bleiben; authenticated-RPCs sind beabsichtigt; st_estimatedextent×3 sind postgis (nicht revokebar).

## Migrationen (in Supabase Migration-History)

make_spatial_ref_sys_read_only · views_security_invoker · harden_function_search_path · revoke_execute_trigger_functions · revoke_execute_internal_secdef_helpers · remove_public_bucket_listing · revoke_anon_execute_login_required_rpcs · revoke_public_execute_login_rpcs

> Liegen aktuell nur in der Supabase-History, nicht im Repo unter `supabase/migrations/`. Bei Bedarf nachziehen für Source-Parität.
