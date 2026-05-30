-- Online-Widerrufsfunktion (Art. 11a Verbraucherrechte-RL 2011/83/EU i.d.F. RL (EU) 2023/2673),
-- anwendbar ab 19.06.2026. Speichert die per Widerrufsbutton abgegebene Widerrufserklärung
-- revisionssicher mit Eingangszeitpunkt. Bezug auf den konkreten Stripe-Kauf
-- (tournament_promotions oder premium_purchases).

create table if not exists widerruf_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  -- Welcher Kauf wurde widerrufen
  purchase_table text not null check (purchase_table in ('tournament_promotions','premium_purchases')),
  purchase_id uuid not null,
  -- Pflichtangaben Art. 11a Abs. 2
  full_name text not null,
  email text not null,
  contract_label text not null,        -- widerrufener Kauf (Produkt), menschenlesbar
  widerruf_text text not null,          -- Wortlaut der Widerrufserklärung (für Eingangsbestätigung)
  -- Stripe-Abwicklung
  refund_id text,
  refund_amount_cents integer,
  -- Audit / Nachweis (Art. 11a Abs. 4: Inhalt + Datum + Uhrzeit des Eingangs)
  requested_at timestamptz not null default now(),
  ip text,
  user_agent text,
  confirmation_sent_at timestamptz
);

create index if not exists idx_widerruf_requests_profile on widerruf_requests(profile_id);
create index if not exists idx_widerruf_requests_email on widerruf_requests(email);
create index if not exists idx_widerruf_requests_requested_at on widerruf_requests(requested_at desc);
create index if not exists idx_widerruf_requests_purchase on widerruf_requests(purchase_table, purchase_id);

-- Service-Role-only (Verbraucher-Anfragen werden serverseitig per Edge Function gehandhabt).
alter table widerruf_requests enable row level security;
-- Keine policies -> RLS blockiert anon/authenticated; Service-Role bypassed RLS.
