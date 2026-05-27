-- 023_safety_blocks_and_reports.sql
-- Apple Guideline 1.2 / 2.1(a) compliance: block users + report messages
-- für DMs und filtered Comments. Apple-Reviewer-Re-Submit 2026-05-27.

create extension if not exists "uuid-ossp";

-- ─── Block-Relation ─────────────────────────────────────────────────
create table if not exists user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocker_idx on user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on user_blocks (blocked_id);

alter table user_blocks enable row level security;
drop policy if exists user_blocks_read on user_blocks;
create policy user_blocks_read on user_blocks for select
  using (blocker_id = auth.uid());

-- ─── Report-Logs für Messages ───────────────────────────────────────
create table if not exists message_reports (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references messages(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);
create index if not exists message_reports_msg_idx on message_reports (message_id);

alter table message_reports enable row level security;
drop policy if exists message_reports_read on message_reports;
create policy message_reports_read on message_reports for select
  using (reporter_id = auth.uid());

-- Hidden/report-count Spalten auf messages für UI-Filter
alter table messages add column if not exists hidden       boolean not null default false;
alter table messages add column if not exists report_count int     not null default 0;

-- ─── RPCs ───────────────────────────────────────────────────────────
-- Block / Unblock
create or replace function block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if target is null or target = auth.uid() then raise exception 'invalid target'; end if;
  insert into user_blocks (blocker_id, blocked_id)
    values (auth.uid(), target)
    on conflict do nothing;
end $$;
revoke all on function block_user(uuid) from public;
grant execute on function block_user(uuid) to authenticated;

create or replace function unblock_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from user_blocks where blocker_id = auth.uid() and blocked_id = target;
end $$;
revoke all on function unblock_user(uuid) from public;
grant execute on function unblock_user(uuid) to authenticated;

-- Report a DM message — 3 unique reports = auto-hide
create or replace function report_message(m_id uuid, r_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare reporter uuid := auth.uid();
declare cnt int;
begin
  if reporter is null then raise exception 'not authenticated'; end if;
  insert into message_reports (message_id, reporter_id, reason)
    values (m_id, reporter, r_reason)
    on conflict do nothing;
  select count(*) into cnt from message_reports where message_id = m_id;
  update messages
     set report_count = cnt,
         hidden = cnt >= 3
   where id = m_id;
end $$;
revoke all on function report_message(uuid, text) from public;
grant execute on function report_message(uuid, text) to authenticated;

-- ─── RLS: filter blocked users + hidden messages ────────────────────
-- Conversations: nur Teilnehmer + nicht von mir geblockter Counterpart
drop policy if exists conv_read on conversations;
create policy conv_read on conversations for select using (
  (user_a = auth.uid() or user_b = auth.uid())
  and not exists (
    select 1 from user_blocks ub
    where ub.blocker_id = auth.uid()
      and ub.blocked_id = case when user_a = auth.uid() then user_b else user_a end
  )
);

-- Messages: Teilnehmer + nicht hidden (außer eigene) + Sender nicht von mir geblockt
drop policy if exists msg_read on messages;
create policy msg_read on messages for select using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
  and (not hidden or sender_id = auth.uid())
  and not exists (
    select 1 from user_blocks ub
    where ub.blocker_id = auth.uid()
      and ub.blocked_id = messages.sender_id
  )
);

-- Comments: filter aus blocked users
drop policy if exists comments_read on match_comments;
create policy comments_read on match_comments for select using (
  (not hidden or user_id = auth.uid())
  and not exists (
    select 1 from user_blocks ub
    where ub.blocker_id = auth.uid()
      and ub.blocked_id = match_comments.user_id
  )
);

-- Friendships: keine Friend-Requests von / zu geblockten Usern
drop policy if exists friendships_read on friendships;
create policy friendships_read on friendships for select using (
  (user_a = auth.uid() or user_b = auth.uid())
  and not exists (
    select 1 from user_blocks ub
    where ub.blocker_id = auth.uid()
      and ub.blocked_id = case when user_a = auth.uid() then user_b else user_a end
  )
);
