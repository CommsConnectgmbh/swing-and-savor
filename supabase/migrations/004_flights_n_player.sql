-- Flights: N-Player-Teams pro Match + optionale Faktoren (z.B. 4v3 mit Ausgleich)
-- Bisher: singles (1v1) und doubles (2v2) via team_*_player1_id/player2_id Spalten.
-- Neu: team_*_player_ids uuid[] (1..4) + team_*_factor numeric default 1.0 + type='flight'.

alter table matches
  add column if not exists team_a_player_ids uuid[] default '{}'::uuid[],
  add column if not exists team_b_player_ids uuid[] default '{}'::uuid[],
  add column if not exists team_a_factor numeric(4,2) not null default 1.0
    check (team_a_factor > 0 and team_a_factor <= 5),
  add column if not exists team_b_factor numeric(4,2) not null default 1.0
    check (team_b_factor > 0 and team_b_factor <= 5);

-- Backfill aus den Legacy-Spalten
update matches
set team_a_player_ids = array_remove(array[team_a_player1_id, team_a_player2_id]::uuid[], null),
    team_b_player_ids = array_remove(array[team_b_player1_id, team_b_player2_id]::uuid[], null)
where (team_a_player_ids is null or array_length(team_a_player_ids,1) is null)
   or (team_b_player_ids is null or array_length(team_b_player_ids,1) is null);

-- Type-Check erweitern um 'flight'
alter table matches drop constraint if exists matches_type_check;
alter table matches add constraint matches_type_check
  check (type in ('singles','doubles','flight'));

-- Bei flight-Matches: 1..4 Spieler pro Seite
alter table matches drop constraint if exists matches_flight_size_check;
alter table matches add constraint matches_flight_size_check
  check (
    type <> 'flight'
    or (
      coalesce(array_length(team_a_player_ids,1),0) between 1 and 4
      and coalesce(array_length(team_b_player_ids,1),0) between 1 and 4
    )
  );

comment on column matches.team_a_player_ids is 'Spieler-IDs Team A (1..4). Wird bei singles/doubles aus Legacy-Spalten gemirrord.';
comment on column matches.team_b_player_ids is 'Spieler-IDs Team B (1..4). Wird bei singles/doubles aus Legacy-Spalten gemirrord.';
comment on column matches.team_a_factor    is 'Punktefaktor Team A. Standard 1.0. Bei asymmetrischen Flights (z.B. 3v4) zum Ausgleich anpassbar.';
comment on column matches.team_b_factor    is 'Punktefaktor Team B. Standard 1.0.';
