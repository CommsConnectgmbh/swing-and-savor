-- Regression (Freigabe 20261023T125548-c92095): join_open_tournament must only
-- admit on an explicit TRUE. A private, open tournament WITHOUT owner (owner_id
-- is NOT NULL today, so the constraint is lifted inside this transaction) must
-- be rejected. Runs against the LOCAL stack; everything is rolled back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f join-null-owner.sql
begin;
alter table public.tournaments alter column owner_id drop not null;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'null-owner-test@example.test');
insert into public.profiles (id, handle, display_name) values ('00000000-0000-4000-8000-0000000000a1', 'null_owner_t', 'T');
insert into public.tournaments (id, name, date, owner_id, visibility, join_mode) values
  ('00000000-0000-4000-8000-0000000000b1', 'Owner-less private', '2026-11-01', null, 'private', 'open'),
  ('00000000-0000-4000-8000-0000000000b2', 'Owner-less friends', '2026-11-01', null, 'friends', 'open'),
  ('00000000-0000-4000-8000-0000000000b3', 'Owner-less public',  '2026-11-01', null, 'public',  'open');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare v text; n int := 0; tid uuid;
begin
  foreach tid in array array['00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000b2']::uuid[] loop
    begin
      perform public.join_open_tournament(tid, true);
      raise notice 'FEHL owner-less % tournament was joinable', tid;
      n := n + 1;
    exception when others then
      get stacked diagnostics v = message_text;
      if v = 'not_found' then raise notice 'ok   owner-less % rejected (not_found)', tid;
      else raise notice 'FEHL unexpected error %', v; n := n + 1; end if;
    end;
  end loop;
  if public.join_open_tournament('00000000-0000-4000-8000-0000000000b3', true) is null then
    raise notice 'FEHL public owner-less not joinable'; n := n + 1;
  else raise notice 'ok   public owner-less still joinable'; end if;
  if n > 0 then raise exception 'FAILED (%)', n; end if;
  raise notice 'ALL CHECKS PASSED';
end $$;
rollback;
