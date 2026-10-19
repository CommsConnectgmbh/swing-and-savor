-- Durable rate limit for the reviewer-bypass Edge Function (security audit 2026-10-19).
--
-- The function is public (verify_jwt off). Every request is recorded here per
-- key (client IP and, for the two reviewer addresses, the email). A key may
-- make at most 10 attempts per 15 minutes; requests over the limit are not
-- recorded and are answered with 429 by the function. Limits are fixed here,
-- not passed in by the caller. Counting and inserting are serialised per key
-- with transaction-scoped advisory locks (taken in sorted order), so parallel
-- requests cannot exceed the limit. Rows older than one hour are removed on
-- every call, which bounds the table even when the caller rotates IPs.
--
-- Only service_role (used by the Edge Function) may call the RPC; the table is
-- not reachable for anon/authenticated (RLS on, no policies, privileges revoked).

create table if not exists public.reviewer_bypass_attempts (
  key          text        not null,
  attempted_at timestamptz not null default now()
);
create index if not exists reviewer_bypass_attempts_key_time
  on public.reviewer_bypass_attempts (key, attempted_at);
create index if not exists reviewer_bypass_attempts_time
  on public.reviewer_bypass_attempts (attempted_at);
alter table public.reviewer_bypass_attempts enable row level security;
revoke all on table public.reviewer_bypass_attempts from public, anon, authenticated;

create or replace function public.reviewer_bypass_register_attempt(p_keys text[])
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  max_attempts constant integer  := 10;
  win          constant interval := interval '15 minutes';
  keep         constant interval := interval '1 hour';
  ks text[];
  k  text;
begin
  select coalesce(array_agg(distinct x order by x), '{}')
    into ks
    from unnest(coalesce(p_keys, '{}'::text[])) as x
   where x is not null;

  if cardinality(ks) = 0 or cardinality(ks) > 2 then
    raise exception 'reviewer_bypass_register_attempt: invalid keys';
  end if;
  foreach k in array ks loop
    if length(k) = 0 or length(k) > 200 then
      raise exception 'reviewer_bypass_register_attempt: invalid key';
    end if;
  end loop;

  -- Sorted order prevents deadlocks between concurrent calls.
  foreach k in array ks loop
    perform pg_advisory_xact_lock(hashtextextended('reviewer_bypass:' || k, 0));
  end loop;

  delete from public.reviewer_bypass_attempts where attempted_at < clock_timestamp() - keep;

  foreach k in array ks loop
    if (select count(*) from public.reviewer_bypass_attempts
         where key = k and attempted_at > clock_timestamp() - win) >= max_attempts then
      return false;
    end if;
  end loop;

  insert into public.reviewer_bypass_attempts (key, attempted_at)
  select x, clock_timestamp() from unnest(ks) as x;
  return true;
end;
$$;

revoke all on function public.reviewer_bypass_register_attempt(text[]) from public, anon, authenticated;
grant execute on function public.reviewer_bypass_register_attempt(text[]) to service_role;
