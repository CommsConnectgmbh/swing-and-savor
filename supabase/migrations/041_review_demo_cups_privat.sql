-- Legal-Recheck 19.10.2026: Demo-Daten der Store-Review-Konten bereinigen.
--
-- 1) Die beiden "Apple Review Demo Cup"-Turniere und der "Spring Cup 2026" (Quelle der alten
--    Marketing-Screenshots) gehoeren den Review-Konten und waren oeffentlich (visibility 'public'),
--    also im Entdecken-Feed und auf oeffentlichen Seiten sichtbar. Sie werden privat gestellt:
--    sichtbar nur noch fuer Besitzer, Teilnehmer und Eingeladene (can_view_tournament).
--    Nichts wird geloescht, der Review-Zugang bleibt unveraendert.
-- 2) Die Demo-Namen spielten auf reale Profigolfer an ("Tiger W.", "Phil M.", "Rory M.",
--    "Jordan S.", Handle "tigerw"). Sie werden durch fiktive Namen ersetzt, passend zu den neuen
--    Marketing-Screenshots: Max K., Ben L., Luca R., Jonas F., Handle "maxk".
--    Nur in Turnieren bzw. im Profil der Review-Konten.
--
-- Fail-closed: bricht ohne Aenderung ab, wenn die Turniere nicht exakt wie erwartet den
-- Review-Konten gehoeren oder der neue Handle schon vergeben ist.

do $$
declare
  ids constant uuid[] := array[
    'd5f0c33c-bdfb-47a0-a219-842db065aedd',
    '9ef0ca0a-4023-4186-a489-a68af0791c46',
    '652b6cd4-5f8d-4c8a-801b-899f57e2c3ab'
  ]::uuid[];
  reviewer_ids uuid[];
  n int;
begin
  select array_agg(id) into reviewer_ids
    from auth.users
   where email in ('apple-review@swingandsavor.at', 'play-review@swingandsavor.at');
  if coalesce(array_length(reviewer_ids, 1), 0) <> 2 then
    raise exception 'Review-Konten nicht eindeutig gefunden, Abbruch';
  end if;

  select count(*) into n
    from public.tournaments t
   where t.id = any (ids)
     and t.owner_id = any (reviewer_ids)
     and t.name in ('🍃 Apple Review Demo Cup', 'Spring Cup 2026');
  if n <> 3 then
    raise exception 'Demo-Turniere nicht wie erwartet gefunden (%), Abbruch', n;
  end if;

  if exists (select 1 from public.profiles where handle = 'maxk'
               and id <> all (reviewer_ids)) then
    raise exception 'Handle maxk bereits vergeben, Abbruch';
  end if;

  update public.tournaments
     set visibility = 'private'
   where id = any (ids)
     and visibility <> 'private';

  -- Matches erben die Sichtbarkeit des Turniers (null), statt sie explizit auf public zu halten.
  update public.matches
     set visibility = null
   where tournament_id = any (ids)
     and visibility = 'public';

  update public.players
     set name = case name
                  when 'Tiger W.'  then 'Max K.'
                  when 'Phil M.'   then 'Ben L.'
                  when 'Rory M.'   then 'Luca R.'
                  when 'Jordan S.' then 'Jonas F.'
                end
   where tournament_id = any (ids)
     and name in ('Tiger W.', 'Phil M.', 'Rory M.', 'Jordan S.');

  update public.profiles
     set display_name = 'Max K.',
         handle = case when handle = 'tigerw' then 'maxk' else handle end
   where id = any (reviewer_ids)
     and display_name = 'Tiger W.';
end $$;
