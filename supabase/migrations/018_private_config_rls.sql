-- 018_private_config_rls.sql
-- Close the advisor finding: private_config currently has RLS disabled,
-- which exposes all rows to the anon role. This table is server-only:
-- it should be read only by service-role / Edge Functions, never by clients.

alter table public.private_config enable row level security;

-- No policies → service-role still bypasses RLS, anon/authenticated lose all access.
-- If any client ever needs a specific key, add a tightly scoped SELECT policy.
