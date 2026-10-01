-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor · Discord-Ankündigung abschaltbar (2026-10-01)              │
-- │                                                                           │
-- │ Öffentliche Cups werden per Trigger notify_discord_on_tournament im       │
-- │ Discord-Server angekündigt (Name, Datum, Teamnamen, Beschreibung,         │
-- │ Endstand). Neu: Spalte tournaments.discord_announce (Standard true wie    │
-- │ bisher); ist sie false, sendet der Trigger nichts. Die App fragt das beim │
-- │ Anlegen/Bearbeiten öffentlicher Cups ab; Duelle setzen sie auf false.     │
-- │ Keine RLS-Änderung. Idempotent.                                           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table tournaments
  add column if not exists discord_announce boolean not null default true;

-- Definition entspricht dem Live-Stand, ergänzt nur um die Opt-out-Prüfung.
create or replace function notify_discord_on_tournament()
returns trigger
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v_url text;
  v_secret text;
  v_event text;
  v_payload jsonb;
begin
  -- only public cups
  if new.visibility is null or new.visibility <> 'public' then
    return new;
  end if;

  -- Ersteller hat die Ankündigung abgeschaltet
  if not coalesce(new.discord_announce, true) then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'active' then
    v_event := 'tournament_created';
  elsif tg_op = 'UPDATE'
        and old.status = 'active'
        and new.status = 'finished' then
    v_event := 'tournament_finished';
  else
    return new;
  end if;

  select value into v_url    from private_config where key = 'discord_notify_url';
  select value into v_secret from private_config where key = 'discord_notify_secret';

  if v_url is null or v_secret is null then
    raise warning 'discord_notify config missing';
    return new;
  end if;

  v_payload := jsonb_build_object(
    'event', v_event,
    'tournament', jsonb_build_object(
      'id', new.id,
      'name', new.name,
      'date', new.date,
      'status', new.status,
      'visibility', new.visibility,
      'team_a_name', new.team_a_name,
      'team_b_name', new.team_b_name,
      'description', new.description
    )
  );

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := v_payload
  );

  return new;
end;
$function$;
