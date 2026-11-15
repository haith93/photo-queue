-- =====================================================================
--  Photo queue  --  schema.sql  (safe to re-run)
--
--  Who can do what (enforced here, not in JavaScript):
--    anyone (anon)  read requests
--    photographer   read + set_done()
--    coordinator    read + insert/update/delete + set_done()
--  Roles live in public.staff, which only the Supabase dashboard can edit.
-- =====================================================================

create table if not exists public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role    text not null check (role in ('coordinator', 'photographer'))
);

-- day/start_time are wall-clock values, like the whiteboard: no timezone.
create table if not exists public.requests (
  id         bigint generated always as identity primary key,
  activity   text not null check (length(trim(activity)) between 1 and 200),
  day        date not null,
  start_time time,
  location   text not null default '' check (length(location) <= 200),
  notes      text not null default '' check (length(notes) <= 2000),
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists requests_day_idx on public.requests (day);

create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.staff where user_id = auth.uid() $$;

-- The photographer's only write. Coordinator may use it too.
create or replace function public.set_done(p_id bigint, p_done boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if public.staff_role() is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.requests
     set done_at = case when p_done then coalesce(done_at, now()) end
   where id = p_id;
  if not found then
    raise exception 'request % not found', p_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------
alter table public.staff    enable row level security;
alter table public.requests enable row level security;

revoke all on public.staff from anon, authenticated;
grant select on public.staff to authenticated;

revoke all on public.requests from anon, authenticated;
grant select on public.requests to anon, authenticated;
grant insert, update, delete on public.requests to authenticated;

revoke execute on function public.set_done(bigint, boolean) from public, anon;
grant execute on function public.set_done(bigint, boolean) to authenticated;
revoke execute on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

drop policy if exists staff_select_own on public.staff;
create policy staff_select_own on public.staff
  for select to authenticated using (user_id = auth.uid());

drop policy if exists requests_read on public.requests;
create policy requests_read on public.requests
  for select to anon, authenticated using (true);

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests
  for insert to authenticated with check (public.staff_role() = 'coordinator');

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests
  for update to authenticated
  using (public.staff_role() = 'coordinator')
  with check (public.staff_role() = 'coordinator');

drop policy if exists requests_delete on public.requests;
create policy requests_delete on public.requests
  for delete to authenticated using (public.staff_role() = 'coordinator');

-- Realtime: every open screen refetches when a request changes.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests') then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
