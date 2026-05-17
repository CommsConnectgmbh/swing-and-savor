-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Push-Trigger: DM / Like / Comment → Edge Function       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create extension if not exists pg_net with schema extensions;

-- Konfig-Tabelle für Edge-Function-Endpoint + Internal-Key.
create table if not exists app_config (
  key   text primary key,
  value text not null
);
alter table app_config enable row level security;

insert into app_config (key, value) values
  ('push_url',          'https://rcqichlyllhwougopfkg.supabase.co/functions/v1/send-push'),
  ('push_internal_key', '<set via supabase function secret PUSH_INTERNAL_KEY>'),
  ('app_origin',        'https://app.swingandsavor.at')
on conflict (key) do update set value = excluded.value;

-- Helper: ruft die Edge Function asynchron
create or replace function call_send_push(user_ids uuid[], payload jsonb)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare url text; key text;
begin
  if array_length(user_ids, 1) is null then return; end if;
  select value into url from app_config where key = 'push_url';
  select value into key from app_config where key = 'push_internal_key';
  if url is null then return; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('content-type','application/json','x-internal-key', coalesce(key,'')),
    body   := jsonb_build_object('user_ids', to_jsonb(user_ids), 'payload', payload),
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function call_send_push(uuid[], jsonb) from public;

-- DM: neue Message → Push an Empfänger
create or replace function trg_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare recipient uuid; sender_name text; sender_handle text; body_preview text;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into recipient from conversations c where c.id = new.conversation_id;
  if recipient is null or recipient = new.sender_id then return new; end if;
  select display_name, handle into sender_name, sender_handle from profiles where id = new.sender_id;
  body_preview := case when length(new.body) > 90 then left(new.body, 87) || '…' else new.body end;
  perform call_send_push(array[recipient], jsonb_build_object(
    'title', coalesce(sender_name, '@'||coalesce(sender_handle,'?')),
    'body',  body_preview,
    'url',   '/messages/' || new.conversation_id::text,
    'tag',   'dm-' || new.conversation_id::text,
    'icon',  '/icons/icon-192.png'
  ));
  return new;
end $$;
drop trigger if exists messages_push on messages;
create trigger messages_push after insert on messages
  for each row execute function trg_message_push();

-- Reaction: Like → Push an Owner
create or replace function trg_reaction_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; liker_name text;
begin
  select t.owner_id into owner
    from matches m join tournaments t on t.id = m.tournament_id
    where m.id = new.match_id;
  if owner is null or owner = new.user_id then return new; end if;
  select display_name into liker_name from profiles where id = new.user_id;
  perform call_send_push(array[owner], jsonb_build_object(
    'title', coalesce(liker_name, 'Jemand') || ' hat geliked ❤️',
    'body',  'Tap um zum Match',
    'url',   '/matches/' || new.match_id::text,
    'tag',   'like-' || new.match_id::text,
    'icon',  '/icons/icon-192.png'
  ));
  return new;
end $$;
drop trigger if exists reactions_push on match_reactions;
create trigger reactions_push after insert on match_reactions
  for each row execute function trg_reaction_push();

-- Comment: neuer Kommentar → Push an Owner + andere Kommentatoren
create or replace function trg_comment_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare recipients uuid[]; commenter_name text; body_preview text;
begin
  select array_remove(array(
    select distinct uid from (
      select t.owner_id as uid
        from matches m join tournaments t on t.id = m.tournament_id
        where m.id = new.match_id
      union
      select c.user_id from match_comments c
        where c.match_id = new.match_id and c.user_id <> new.user_id
    ) sub where uid is not null
  ), new.user_id) into recipients;
  if recipients is null or array_length(recipients, 1) is null then return new; end if;
  select display_name into commenter_name from profiles where id = new.user_id;
  body_preview := case when length(new.body) > 90 then left(new.body, 87) || '…' else new.body end;
  perform call_send_push(recipients, jsonb_build_object(
    'title', coalesce(commenter_name, 'Jemand') || ' kommentiert',
    'body',  body_preview,
    'url',   '/matches/' || new.match_id::text,
    'tag',   'comment-' || new.match_id::text,
    'icon',  '/icons/icon-192.png'
  ));
  return new;
end $$;
drop trigger if exists comments_push on match_comments;
create trigger comments_push after insert on match_comments
  for each row execute function trg_comment_push();
