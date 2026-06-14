-- 033_pro_entitlements.sql
-- Per-USER "Pro" entitlement, for personal paid features such as the embedded
-- QuickLaunch AR launch monitor.
--
-- Rationale: the existing `premium_purchases` ledger is per-TOURNAMENT (a cup owner
-- pays to upgrade an event). A launch monitor is a personal, per-device tool, so it
-- needs an entitlement attached to the profile, not a tournament. This mirrors the
-- premium ledger shape (pending row written by the checkout edge function, flipped
-- to 'active' on payment reconciliation) but scoped to a user.

-- 1) Fast-path flags on the profile, read by the client gate (proAccess.js / isPro()).
alter table public.profiles
  add column if not exists pro_until timestamptz,        -- subscription / time-boxed access
  add column if not exists is_pro    boolean not null default false; -- optional lifetime unlock

-- 2) Purchase/entitlement ledger.
create table if not exists public.pro_entitlements (
  id                            uuid primary key default gen_random_uuid(),
  profile_id                    uuid not null references public.profiles(id) on delete cascade,
  product                       text not null default 'launch_monitor',
  plan                          text not null default 'lifetime',  -- 'lifetime' | 'annual' | 'monthly'
  amount_eur_cents              int  not null,
  currency                      text not null default 'eur',
  stripe_session_id             text,
  stripe_checkout_url           text,
  status                        text not null default 'pending',   -- 'pending' | 'active' | 'refunded'
  instant_execution_consent     boolean not null default false,
  instant_execution_consent_at  timestamptz,
  created_at                    timestamptz not null default now(),
  activated_at                  timestamptz,
  metadata                      jsonb
);

create index if not exists pro_entitlements_profile_idx
  on public.pro_entitlements (profile_id);

create unique index if not exists pro_entitlements_session_idx
  on public.pro_entitlements (stripe_session_id)
  where stripe_session_id is not null;

-- 3) RLS: users may READ their own entitlement history. All writes go through the
--    service-role edge functions (create-pro-checkout + the payment reconciler).
alter table public.pro_entitlements enable row level security;

drop policy if exists pro_entitlements_select_own on public.pro_entitlements;
create policy pro_entitlements_select_own on public.pro_entitlements
  for select using (auth.uid() = profile_id);

-- NOTE: profiles.pro_until / is_pro are written by the service role only. The
-- existing profiles UPDATE policy must NOT allow users to set these themselves —
-- verify that before deploy (a user-writable `pro_until` would be a free Pro unlock).
