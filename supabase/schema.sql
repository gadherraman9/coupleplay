-- CouplePlay database. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every table keeps the app's object in `data`; the other columns exist so
-- row level security can decide who may read or write each row.

-- ---------- helpers ----------

create or replace function public.me() returns text
language sql stable as $$ select auth.uid()::text $$;

create table if not exists public.profiles (
  id text primary key,
  username text not null unique,
  suspended boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id text primary key,
  from_id text not null,
  to_id text not null,
  data jsonb not null
);

create table if not exists public.friendships (
  id text primary key,
  a text not null,
  b text not null,
  data jsonb not null
);

create table if not exists public.blocks (
  id text primary key,
  by_id text not null,
  target_id text not null,
  data jsonb not null
);

create table if not exists public.reports (
  id text primary key,
  by_id text not null,
  target_id text not null,
  data jsonb not null,
  unique (by_id, target_id)
);

create table if not exists public.strangers (
  id text primary key,
  a text not null,
  b text not null,
  data jsonb not null
);

create table if not exists public.games (
  id text primary key,
  host text not null,
  players text[] not null,
  data jsonb not null
);

create table if not exists public.messages (
  id text primary key,
  conv_id text not null,
  from_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conv_id, created_at);

create table if not exists public.queue (
  id text primary key,
  data jsonb not null
);

create table if not exists public.presence (
  id text primary key,
  at bigint not null
);

create table if not exists public.reads (
  id text primary key,
  user_id text not null,
  at bigint not null
);

create or replace function public.is_bot(uid text) returns boolean
language sql immutable as $$ select uid like 'bot-%' $$;

create or replace function public.is_blocked(x text, y text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (by_id = x and target_id = y) or (by_id = y and target_id = x)
  )
$$;

-- Who may read a conversation: DM members, room = everyone signed in,
-- stranger chat members, game players.
create or replace function public.can_access_conv(conv text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when conv like 'dm:%' then public.me() = any (string_to_array(substr(conv, 4), ':'))
    when conv like 'room:%' then auth.uid() is not null
    when conv like 'str:%' then exists (
      select 1 from strangers s where s.id = substr(conv, 5) and public.me() in (s.a, s.b))
    when conv like 'game:%' then exists (
      select 1 from games g where g.id = substr(conv, 6) and public.me() = any (g.players))
    else false
  end
$$;

create or replace function public.can_send(conv text, sender text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_access_conv(conv)
    and (sender = public.me() or public.is_bot(sender))
    and not coalesce((select suspended from profiles where id = public.me()), false)
    and (
      conv not like 'dm:%'
      or not public.is_blocked(
        (string_to_array(substr(conv, 4), ':'))[1],
        (string_to_array(substr(conv, 4), ':'))[2])
    )
    and (
      conv not like 'str:%'
      or exists (select 1 from strangers s where s.id = substr(conv, 5) and coalesce((s.data->>'open')::boolean, false))
    )
$$;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.strangers enable row level security;
alter table public.games enable row level security;
alter table public.messages enable row level security;
alter table public.queue enable row level security;
alter table public.presence enable row level security;
alter table public.reads enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = public.me() and suspended = false);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = public.me()) with check (id = public.me());
-- Nobody can lift their own suspension.
revoke update on public.profiles from authenticated, anon;
grant update (username, data) on public.profiles to authenticated;

drop policy if exists "requests read" on public.friend_requests;
create policy "requests read" on public.friend_requests for select to authenticated
  using (public.me() in (from_id, to_id));
drop policy if exists "requests insert" on public.friend_requests;
create policy "requests insert" on public.friend_requests for insert to authenticated
  with check (
    (from_id = public.me() and not public.is_blocked(from_id, to_id))
    or (public.is_bot(from_id) and to_id = public.me())
  );
drop policy if exists "requests delete" on public.friend_requests;
create policy "requests delete" on public.friend_requests for delete to authenticated
  using (public.me() in (from_id, to_id));

drop policy if exists "friendships read" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated
  using (public.me() in (a, b));
drop policy if exists "friendships insert" on public.friendships;
create policy "friendships insert" on public.friendships for insert to authenticated
  with check (
    public.me() in (a, b)
    and (
      public.is_bot(a) or public.is_bot(b)
      or exists (
        select 1 from public.friend_requests r
        where r.to_id = public.me() and r.from_id = case when a = public.me() then b else a end
      )
    )
  );
drop policy if exists "friendships delete" on public.friendships;
create policy "friendships delete" on public.friendships for delete to authenticated
  using (public.me() in (a, b));

drop policy if exists "blocks read" on public.blocks;
create policy "blocks read" on public.blocks for select to authenticated
  using (public.me() in (by_id, target_id));
drop policy if exists "blocks write" on public.blocks;
create policy "blocks write" on public.blocks for insert to authenticated with check (by_id = public.me());
drop policy if exists "blocks delete" on public.blocks;
create policy "blocks delete" on public.blocks for delete to authenticated using (by_id = public.me());

drop policy if exists "reports read own" on public.reports;
create policy "reports read own" on public.reports for select to authenticated using (by_id = public.me());
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated
  with check (by_id = public.me() and target_id <> public.me());

drop policy if exists "strangers read" on public.strangers;
create policy "strangers read" on public.strangers for select to authenticated using (public.me() in (a, b));
drop policy if exists "strangers insert" on public.strangers;
create policy "strangers insert" on public.strangers for insert to authenticated with check (public.me() in (a, b));
drop policy if exists "strangers update" on public.strangers;
create policy "strangers update" on public.strangers for update to authenticated using (public.me() in (a, b));

drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select to authenticated using (public.me() = any (players));
drop policy if exists "games insert" on public.games;
create policy "games insert" on public.games for insert to authenticated
  with check (host = public.me() and public.me() = any (players));
drop policy if exists "games update" on public.games;
create policy "games update" on public.games for update to authenticated using (public.me() = any (players));
drop policy if exists "games delete" on public.games;
create policy "games delete" on public.games for delete to authenticated using (host = public.me());

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated using (public.can_access_conv(conv_id));
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert to authenticated with check (public.can_send(conv_id, from_id));
drop policy if exists "messages delete" on public.messages;
create policy "messages delete" on public.messages for delete to authenticated using (from_id = public.me());

drop policy if exists "queue read" on public.queue;
create policy "queue read" on public.queue for select to authenticated using (true);
drop policy if exists "queue insert" on public.queue;
create policy "queue insert" on public.queue for insert to authenticated with check (id = public.me());
drop policy if exists "queue update" on public.queue;
create policy "queue update" on public.queue for update to authenticated using (id = public.me());
-- Matchmaking removes both people from the queue.
drop policy if exists "queue delete" on public.queue;
create policy "queue delete" on public.queue for delete to authenticated using (true);

drop policy if exists "presence read" on public.presence;
create policy "presence read" on public.presence for select to authenticated using (true);
drop policy if exists "presence write" on public.presence;
create policy "presence write" on public.presence for insert to authenticated with check (id = public.me());
drop policy if exists "presence update" on public.presence;
create policy "presence update" on public.presence for update to authenticated using (id = public.me());

drop policy if exists "reads own" on public.reads;
create policy "reads own" on public.reads for all to authenticated
  using (user_id = public.me()) with check (user_id = public.me());

-- ---------- automatic suspension after 10 reports ----------

create or replace function public.handle_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct by_id) from reports where target_id = new.target_id) >= 10 then
    update profiles set suspended = true where id = new.target_id;
  end if;
  return new;
end $$;

drop trigger if exists on_report on public.reports;
create trigger on_report after insert on public.reports
  for each row execute function public.handle_report();

-- ---------- demo bots ----------

insert into public.profiles (id, username, data) values
  ('bot-priya', 'priya', '{"id":"bot-priya","username":"priya","displayName":"Priya","hue":330,"isGuest":false,"isBot":true,"hearts":0,"streak":0,"ownedThemes":[],"appTheme":"rose","chatTheme":"classic","createdAt":0}'),
  ('bot-rahul', 'rahul', '{"id":"bot-rahul","username":"rahul","displayName":"Rahul","hue":215,"isGuest":false,"isBot":true,"hearts":0,"streak":0,"ownedThemes":[],"appTheme":"rose","chatTheme":"classic","createdAt":0}'),
  ('bot-meera', 'meera', '{"id":"bot-meera","username":"meera","displayName":"Meera","hue":20,"isGuest":false,"isBot":true,"hearts":0,"streak":0,"ownedThemes":[],"appTheme":"rose","chatTheme":"classic","createdAt":0}'),
  ('bot-arjun', 'arjun', '{"id":"bot-arjun","username":"arjun","displayName":"Arjun","hue":160,"isGuest":false,"isBot":true,"hearts":0,"streak":0,"ownedThemes":[],"appTheme":"rose","chatTheme":"classic","createdAt":0}'),
  ('bot-riya', 'riya', '{"id":"bot-riya","username":"riya","displayName":"Riya","hue":275,"isGuest":false,"isBot":true,"hearts":0,"streak":0,"ownedThemes":[],"appTheme":"rose","chatTheme":"classic","createdAt":0}')
on conflict (id) do nothing;

-- ---------- live updates ----------

do $$
declare t text;
begin
  foreach t in array array['profiles','friend_requests','friendships','blocks','strangers','games','messages','queue','presence'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- private photos and voice notes ----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 5242880)
on conflict (id) do nothing;

-- Files live at "<conversation id with : replaced by _>/<file>".
drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.can_access_conv(replace((storage.foldername(name))[1], '_', ':')));
drop policy if exists "media upload" on storage.objects;
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_send(replace((storage.foldername(name))[1], '_', ':'), public.me()));
drop policy if exists "media delete" on storage.objects;
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner_id = public.me());
