-- 034_pro_entitlements_activate.sql
-- Deploys + hardens the per-user "Pro" entitlement backing the embedded QuickLaunch
-- AR launch monitor. Supersedes/completes 033 (which was authored but never applied
-- to the remote DB) and adds:
--   * stripe_payment_intent_id on the ledger (needed for refund reconciliation)
--   * a BEFORE UPDATE trigger that stops end users from self-granting Pro.
-- Idempotent.

-- 1) Fast-path flags on the profile, read by the client gate (proAccess.js/isPro()).
alter table public.profiles
  add column if not exists pro_until timestamptz,
  add column if not exists is_pro    boolean not null default false;

-- 2) Purchase/entitlement ledger.
create table if not exists public.pro_entitlements (
  id                            uuid primary key default gen_random_uuid(),
  profile_id                    uuid not null references public.profiles(id) on delete cascade,
  product                       text not null default 'launch_monitor',
  plan                          text not null default 'lifetime',
  amount_eur_cents              int  not null,
  currency                      text not null default 'eur',
  stripe_session_id             text,
  stripe_checkout_url           text,
  stripe_payment_intent_id      text,
  status                        text not null default 'pending',   -- pending | active | failed | refunded
  instant_execution_consent     boolean not null default false,
  instant_execution_consent_at  timestamptz,
  created_at                    timestamptz not null default now(),
  activated_at                  timestamptz,
  metadata                      jsonb
);
create index if not exists pro_entitlements_profile_idx on public.pro_entitlements (profile_id);
create unique index if not exists pro_entitlements_session_idx
  on public.pro_entitlements (stripe_session_id) where stripe_session_id is not null;
create index if not exists pro_entitlements_pi_idx
  on public.pro_entitlements (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- 3) RLS: users read their own entitlement history; all writes are service-role only.
alter table public.pro_entitlements enable row level security;
drop policy if exists pro_entitlements_select_own on public.pro_entitlements;
create policy pro_entitlements_select_own on public.pro_entitlements
  for select using (auth.uid() = profile_id);

-- 4) Protect is_pro / pro_until against self-grant.
--    profiles_update_self lets a user update their own row (any column) — a client
--    could set is_pro=true for a free unlock. RLS can't compare OLD/NEW, so a
--    BEFORE UPDATE trigger enforces that only the service role (webhook / checkout
--    edge functions) may change these flags. Column-agnostic and future-proof.
create or replace function public.enforce_pro_flags_service_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if new.is_pro is distinct from old.is_pro
     or new.pro_until is distinct from old.pro_until then
    raise exception 'pro flags (is_pro/pro_until) are service-role only';
  end if;
  return new;
end
$$;

drop trigger if exists trg_enforce_pro_flags on public.profiles;
create trigger trg_enforce_pro_flags
  before update on public.profiles
  for each row execute function public.enforce_pro_flags_service_only();
