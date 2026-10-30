-- CouplePlay v2: message ticks (sent / delivered / seen) and live "last seen".
-- Safe to run on the existing database: it only adds a column, a policy and
-- realtime for the reads table. No data is deleted.
-- Supabase -> SQL Editor -> New query -> paste all of this -> Run.

-- Each reads row is "<user>|<conversation>" (seen) or "<user>|<conversation>|d" (delivered).
alter table public.reads add column if not exists conv_id text;
update public.reads set conv_id = split_part(id, '|', 2) where conv_id is null;
create index if not exists reads_conv_idx on public.reads (conv_id);

-- The other people in a chat may see how far you have received / read it.
drop policy if exists "reads shared" on public.reads;
create policy "reads shared" on public.reads for select to authenticated
  using (conv_id is not null and public.can_access_conv(conv_id));

-- Ticks turn blue live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reads'
  ) then
    alter publication supabase_realtime add table public.reads;
  end if;
end $$;
