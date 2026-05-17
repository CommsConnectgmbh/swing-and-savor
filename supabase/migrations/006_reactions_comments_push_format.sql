-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Swing & Savor — Social v3: Likes, Comments, Push-Subs, Stableford-Flag  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Likes
create table if not exists match_reactions (
  match_id   uuid not null references matches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  emoji      text not null default '❤️' check (length(emoji) between 1 and 8),
  created_at timestamptz default now(),
  primary key (match_id, user_id)
);
create index if not exists match_reactions_match_idx on match_reactions (match_id);
alter table match_reactions enable row level security;

drop policy if exists reactions_read   on match_reactions;
drop policy if exists reactions_insert on match_reactions;
drop policy if exists reactions_update on match_reactions;
drop policy if exists reactions_delete on match_reactions;

create policy reactions_read   on match_reactions for select using (true);
create policy reactions_insert on match_reactions for insert with check (user_id = auth.uid());
create policy reactions_update on match_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on match_reactions for delete using (user_id = auth.uid());

-- Comments (Thread pro Match, Moderation über hidden + report_count)
create table if not exists match_comments (
  id           uuid primary key default uuid_generate_v4(),
  match_id     uuid not null references matches(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  body         text not null check (length(body) between 1 and 800),
  created_at   timestamptz default now(),
  hidden       boolean not null default false,
  report_count int not null default 0
);
create index if not exists match_comments_match_idx on match_comments (match_id, created_at);
alter table match_comments enable row level security;

drop policy if exists comments_read   on match_comments;
drop policy if exists comments_insert on match_comments;
drop policy if exists comments_update on match_comments;
drop policy if exists comments_delete on match_comments;

create policy comments_read   on match_comments for select using (not hidden or user_id = auth.uid());
create policy comments_insert on match_comments for insert with check (user_id = auth.uid());
create policy comments_update on match_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete on match_comments for delete using (user_id = auth.uid());

-- Anti-Spam: User flagt Comment, ab 3 Reports auto-hidden
create or replace function report_comment(c_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update match_comments
     set report_count = report_count + 1,
         hidden = (report_count + 1) >= 3
   where id = c_id;
end $$;
revoke all on function report_comment(uuid) from public;
grant execute on function report_comment(uuid) to authenticated;

-- Push-Subscriptions (Web Push + APNs/FCM Native)
create table if not exists push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  platform     text not null check (platform in ('web','ios','android')),
  endpoint     text not null,
  keys         jsonb,
  device_label text,
  created_at   timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subs_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- matches.format
alter table matches
  add column if not exists format text not null default 'match_play'
    check (format in ('match_play','stableford'));

-- View für Feed-Performance (Counts pro Match)
create or replace view match_social_counts as
  select m.id as match_id,
         coalesce((select count(*) from match_reactions r where r.match_id = m.id), 0) as like_count,
         coalesce((select count(*) from match_comments  c where c.match_id = m.id and not c.hidden), 0) as comment_count
  from matches m;
grant select on match_social_counts to anon, authenticated;
