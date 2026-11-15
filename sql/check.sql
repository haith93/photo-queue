-- =====================================================================
--  check.sql  --  proves the access rules. Run in the Supabase SQL editor
--  AFTER schema.sql and after both staff rows exist. Changes nothing:
--  everything happens inside a transaction that is rolled back.
--  Any failure stops with "FAIL: ...". Success prints only "ok" notices.
-- =====================================================================
begin;

insert into public.requests (activity, day) values ('check.sql probe', current_date);

-- ---------- anonymous viewer ----------
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.requests where activity = 'check.sql probe';
  if n <> 1 then raise exception 'FAIL: anon cannot read'; end if;

  begin
    insert into public.requests (activity, day) values ('x', current_date);
    raise exception 'FAIL: anon could insert';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.set_done((select id from public.requests where activity = 'check.sql probe'), true);
    raise exception 'FAIL: anon could call set_done';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: anon reads, cannot write';
end $$;
reset role;

-- ---------- photographer ----------
select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated',
                    'sub', (select user_id from public.staff where role = 'photographer' limit 1))::text, true);
set local role authenticated;
do $$
declare n int; probe bigint;
begin
  if auth.uid() is null then raise exception 'FAIL: add a photographer row to public.staff first'; end if;
  select id into probe from public.requests where activity = 'check.sql probe';

  update public.requests set activity = 'hacked' where id = probe;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: photographer could edit'; end if;

  delete from public.requests where id = probe;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: photographer could delete'; end if;

  begin
    insert into public.requests (activity, day) values ('x', current_date);
    raise exception 'FAIL: photographer could insert';
  exception when insufficient_privilege then null;
  end;

  perform public.set_done(probe, true);
  if (select done_at from public.requests where id = probe) is null then
    raise exception 'FAIL: photographer could not mark done';
  end if;
  raise notice 'ok: photographer can only mark done';
end $$;
reset role;

-- ---------- coordinator ----------
select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated',
                    'sub', (select user_id from public.staff where role = 'coordinator' limit 1))::text, true);
set local role authenticated;
do $$
declare n int;
begin
  if auth.uid() is null then raise exception 'FAIL: add a coordinator row to public.staff first'; end if;
  insert into public.requests (activity, day) values ('check.sql probe 2', current_date);
  update public.requests set notes = 'edited' where activity = 'check.sql probe 2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: coordinator could not edit'; end if;
  delete from public.requests where activity like 'check.sql probe%';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'FAIL: coordinator could not delete'; end if;
  raise notice 'ok: coordinator has full control';
end $$;
reset role;

rollback;
