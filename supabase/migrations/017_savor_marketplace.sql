-- 017_savor_marketplace.sql
-- The Lifestyle Layer (Savor mode). Snapshots remote DDL applied 2026-05-19 via Management API.
-- Three tables (savor_partners, savor_offers, savor_wishlist), slug triggers, RLS, public storage bucket.

create table if not exists public.savor_partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  type          text default 'partner' check (type in ('partner','club','restaurant','travel_op','brand','pro_shop')),
  logo_url      text,
  website_url   text,
  city          text,
  country_code  text,
  description   text,
  contact_email text,
  status        text not null default 'active' check (status in ('active','paused','blocked')),
  created_at    timestamptz not null default now()
);

create table if not exists public.savor_offers (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in ('tee_times','experiences','dining','apparel','travel','equipment')),
  title           text not null,
  slug            text unique,
  subtitle        text,
  description     text,
  image_url       text,
  city            text,
  country_code    text,
  partner_id      uuid references public.savor_partners(id) on delete set null,
  price_eur_cents integer,
  price_label     text,
  currency        text default 'eur',
  external_url    text,
  available_from  date,
  available_until date,
  tee_time_at     timestamptz,
  highlight       boolean default false,
  badge           text,
  sort_order      integer default 0,
  status          text not null default 'active' check (status in ('active','sold_out','draft','archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists savor_offers_cat_idx       on public.savor_offers (category, status, sort_order);
create index if not exists savor_offers_highlight_idx on public.savor_offers (highlight) where highlight = true;
create index if not exists savor_offers_city_idx      on public.savor_offers (city);
create index if not exists savor_offers_tee_at_idx    on public.savor_offers (tee_time_at) where tee_time_at is not null;

create table if not exists public.savor_wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  offer_id   uuid not null references public.savor_offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, offer_id)
);

-- Slug auto-fill
create or replace function public.gen_partner_slug() returns text language plpgsql as $$
declare cand text;
begin
  loop
    cand := lower(substring(md5(random()::text), 1, 8));
    exit when not exists (select 1 from savor_partners where slug = cand);
  end loop;
  return cand;
end $$;

create or replace function public.gen_offer_slug() returns text language plpgsql as $$
declare cand text;
begin
  loop
    cand := lower(substring(md5(random()::text), 1, 10));
    exit when not exists (select 1 from savor_offers where slug = cand);
  end loop;
  return cand;
end $$;

create or replace function public.set_partner_slug_default() returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then new.slug := gen_partner_slug(); end if;
  return new;
end $$;

create or replace function public.set_offer_slug_default() returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then new.slug := gen_offer_slug(); end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists savor_partners_slug on public.savor_partners;
create trigger savor_partners_slug before insert on public.savor_partners
  for each row execute function public.set_partner_slug_default();

drop trigger if exists savor_offers_slug on public.savor_offers;
create trigger savor_offers_slug before insert or update on public.savor_offers
  for each row execute function public.set_offer_slug_default();

-- RLS
alter table public.savor_partners enable row level security;
alter table public.savor_offers   enable row level security;
alter table public.savor_wishlist enable row level security;

drop policy if exists savor_partners_select_any  on public.savor_partners;
drop policy if exists savor_partners_admin_write on public.savor_partners;
create policy savor_partners_select_any on public.savor_partners
  for select using (status = 'active');
create policy savor_partners_admin_write on public.savor_partners
  for all
  using      ((auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de')
  with check ((auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de');

drop policy if exists savor_offers_select_active on public.savor_offers;
drop policy if exists savor_offers_admin_write   on public.savor_offers;
create policy savor_offers_select_active on public.savor_offers
  for select using (status in ('active','sold_out'));
create policy savor_offers_admin_write on public.savor_offers
  for all
  using      ((auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de')
  with check ((auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de');

drop policy if exists savor_wishlist_self_all on public.savor_wishlist;
create policy savor_wishlist_self_all on public.savor_wishlist
  for all
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage bucket savor-images: public-read, admin-write
insert into storage.buckets (id, name, public)
values ('savor-images', 'savor-images', true)
on conflict (id) do nothing;

drop policy if exists savor_images_select_any   on storage.objects;
drop policy if exists savor_images_admin_write  on storage.objects;
create policy savor_images_select_any on storage.objects
  for select using (bucket_id = 'savor-images');
create policy savor_images_admin_write on storage.objects
  for insert
  with check (
    bucket_id = 'savor-images'
    and (auth.jwt() ->> 'email') = 'rainer.roloff@comms-connect.de'
  );
