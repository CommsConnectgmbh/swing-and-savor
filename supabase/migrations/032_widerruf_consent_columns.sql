-- §356 Abs. 5 BGB: ausdrückliche Zustimmung zur sofortigen Ausführung + Kenntnis vom
-- Erlöschen des Widerrufsrechts. Plus Widerruf-Zeitstempel je Kauf.

alter table tournament_promotions
  add column if not exists instant_execution_consent boolean not null default false,
  add column if not exists instant_execution_consent_at timestamptz,
  add column if not exists widerrufen_at timestamptz;

alter table premium_purchases
  add column if not exists instant_execution_consent boolean not null default false,
  add column if not exists instant_execution_consent_at timestamptz,
  add column if not exists widerrufen_at timestamptz;

comment on column tournament_promotions.instant_execution_consent is 'Verbraucher hat sofortige Aktivierung verlangt und Erlöschen des Widerrufsrechts bei vollständiger Ausführung bestätigt (§356 Abs. 5 BGB).';
comment on column premium_purchases.instant_execution_consent is 'Verbraucher hat sofortige Aktivierung verlangt und Erlöschen des Widerrufsrechts bei vollständiger Ausführung bestätigt (§356 Abs. 5 BGB).';
