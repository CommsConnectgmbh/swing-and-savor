-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Tournament Boost/Highlight                              │
-- │ Bezahlte „nach oben schieben" + Highlight-Marker, eBay-Kleinanzeigen-   │
-- │ Style. Stripe-Checkout schreibt promoted_until + promo_tier zurück.     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table tournaments
  add column if not exists promoted_until timestamptz,
  add column if not exists promo_tier text check (promo_tier in ('top','highlight','both'));

create index if not exists tournaments_promoted_idx
  on tournaments (promoted_until desc) where promoted_until is not null;

comment on column tournaments.promoted_until is 'Bezahlte Boost-Frist; aktiv solange > now(). Sortiert Discover-Feed.';
comment on column tournaments.promo_tier     is 'top = ganz oben, highlight = farbliche Hervorhebung, both = beides.';

-- Verkaufslog je Boost-Kauf
create table if not exists tournament_promotions (
  id                       uuid primary key default gen_random_uuid(),
  tournament_id            uuid not null references tournaments(id) on delete cascade,
  buyer_profile_id         uuid references profiles(id) on delete set null,
  tier                     text not null check (tier in ('top','highlight','both')),
  duration_days            int  not null check (duration_days between 1 and 30),
  amount_eur_cents         int  not null check (amount_eur_cents >= 0),
  currency                 text not null default 'eur',
  stripe_session_id        text,
  stripe_payment_intent_id text,
  stripe_checkout_url      text,
  status                   text not null default 'pending'
                                 check (status in ('pending','paid','failed','refunded')),
  starts_at                timestamptz,
  expires_at               timestamptz,
  metadata                 jsonb default '{}'::jsonb,
  created_at               timestamptz default now(),
  paid_at                  timestamptz
);

create index if not exists promotions_tournament_idx on tournament_promotions (tournament_id);
create index if not exists promotions_status_idx     on tournament_promotions (status);
create index if not exists promotions_session_idx    on tournament_promotions (stripe_session_id);

alter table tournament_promotions enable row level security;

drop policy if exists promotions_read_own on tournament_promotions;
create policy promotions_read_own on tournament_promotions for select using (
  buyer_profile_id = auth.uid()
  or exists (select 1 from tournaments t where t.id = tournament_id and t.owner_id = auth.uid())
  or (auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de'
);
