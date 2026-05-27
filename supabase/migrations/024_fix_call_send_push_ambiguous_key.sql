-- 024_fix_call_send_push_ambiguous_key.sql
-- Pre-existing bug: call_send_push() deklarierte eine lokale Variable "key"
-- und führte dann `select … from app_config where key = '…'` aus. Postgres warf
-- 42702 ("column reference key is ambiguous"). Der messages_push AFTER-Trigger
-- callt diese Function, also failed jeder Message-Insert sobald push_url in
-- app_config einen Wert hat. In Production fiel das nie auf, weil push_url
-- NULL ist und die Function vor der Ambiguity returnt.
--
-- Discovered beim Apple-Resubmit 2026-05-27 als der reviewer-bypass-Seed
-- Demo-DMs einfügen wollte und 0 Rows landeten.

create or replace function public.call_send_push(user_ids uuid[], payload jsonb)
returns void
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  push_endpoint text;
  internal_key  text;
begin
  if array_length(user_ids, 1) is null then return; end if;
  select value into push_endpoint from app_config where app_config.key = 'push_url';
  select value into internal_key  from app_config where app_config.key = 'push_internal_key';
  if push_endpoint is null then return; end if;
  perform net.http_post(
    url := push_endpoint,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-key', coalesce(internal_key, '')
    ),
    body := jsonb_build_object('user_ids', to_jsonb(user_ids), 'payload', payload),
    timeout_milliseconds := 5000
  );
end $$;
