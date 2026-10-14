-- ============================================================
-- The Wellness Trail (trail.html). Applied as migrations wellness_trail_tables, wellness_trail_functions,
-- wellness_trail_leave_remove_soft (leaving a convoy clears team_id; nothing is deleted).
-- An Oregon Trail style journey through Realms 1-5 (chapters 1-16).
--
-- Rules the server enforces (so nobody can rush or grief):
--   • 1,200 miles to finish; at most 200 miles per student per real day
--     (America/Denver calendar day). The cap is per STUDENT, not per run,
--     so starting over never resets it. Fastest possible finish: 6 days.
--   • Every student has their own wagon (run). Teammates can only HELP:
--     a gift is taken from the giver's own supplies and added to the receiver's.
--   • Trail markers left for others use preset health tips (no free text).
--   • Finishing posts the score to the arcade leaderboard ('wellness_trail').
-- Same pattern as the rest of the site: tables locked (RLS on, no policies);
-- the page only calls the SECURITY DEFINER functions below. Safe to re-run.
-- ============================================================

create table if not exists public.trail_runs (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  trimester   text not null,
  run_no      int  not null default 1,
  status      text not null default 'active' check (status in ('active','done','over')),
  miles       int  not null default 0,
  state       jsonb not null default '{}'::jsonb,
  score       int,
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists trail_runs_one_active on public.trail_runs (student_id, trimester) where status = 'active';
alter table public.trail_runs enable row level security;

create table if not exists public.trail_daily (          -- miles traveled per student per real day
  student_id uuid not null references public.students(id) on delete cascade,
  day        date not null,
  miles      int  not null default 0,
  primary key (student_id, day)
);
alter table public.trail_daily enable row level security;

create table if not exists public.trail_teams (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  trimester  text not null,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists trail_teams_code on public.trail_teams (trimester, code);
alter table public.trail_teams enable row level security;

create table if not exists public.trail_members (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  team_id    uuid references public.trail_teams(id) on delete cascade,   -- null = left their convoy
  joined_at  timestamptz not null default now(),
  primary key (student_id, trimester)
);
alter table public.trail_members enable row level security;

create table if not exists public.trail_gifts (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.students(id) on delete cascade,
  to_id      uuid not null references public.students(id) on delete cascade,
  item       text not null,
  qty        int  not null,
  claimed    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.trail_gifts enable row level security;

create table if not exists public.trail_markers (
  id         bigint generated always as identity primary key,
  trimester  text not null,
  run_id     uuid references public.trail_runs(id) on delete cascade,
  miles      int  not null,
  who        text not null,
  tip        int  not null,
  created_at timestamptz not null default now()
);
create index if not exists trail_markers_tri on public.trail_markers (trimester, miles);
alter table public.trail_markers enable row level security;

insert into public.arcade_games (key, title, max_score, medals) values
  ('wellness_trail', 'The Wellness Trail', 5000, '{800,1400,2000,2600}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

-- ---------- helpers (private) ----------
create or replace function public._trail_today() returns date
language sql stable as $$ select (now() at time zone 'America/Denver')::date; $$;

create or replace function public._trail_left(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select 200 - coalesce((select miles from public.trail_daily where student_id = p_student and day = public._trail_today()), 0);
$$;

create or replace function public._trail_team(p_student uuid, p_tri text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.display_name, 'me', s.id = p_student,
        'miles', r.miles, 'status', coalesce(r.status, 'none'),
        'left', (select count(*) from jsonb_array_elements(coalesce(r.state->'party', '[]'::jsonb)) x where x->>'st' <> 'out'),
        'body', (r.state->'tri'->>'body')::int, 'mind', (r.state->'tri'->>'mind')::int, 'social', (r.state->'tri'->>'social')::int,
        'bots', jsonb_array_length(coalesce(r.state->'bots', '[]'::jsonb)),
        'finished', (select count(*) from public.trail_runs d where d.student_id = s.id and d.trimester = p_tri and d.status = 'done')
      ) order by m.joined_at), '[]'::jsonb)
      from public.trail_members m join public.students s on s.id = m.student_id
      left join lateral (select * from public.trail_runs r where r.student_id = s.id and r.trimester = p_tri
                         order by (r.status = 'active') desc, r.updated_at desc limit 1) r on true
      where m.team_id = t.id)) end
  from public.trail_members mm join public.trail_teams t on t.id = mm.team_id
  where mm.student_id = p_student and mm.trimester = p_tri;
$$;

-- add any unclaimed gifts to a run's state; returns the list of gifts applied
create or replace function public._trail_claim(p_run public.trail_runs) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g record; st jsonb := p_run.state; out jsonb := '[]'::jsonb;
begin
  for g in select tg.*, s.display_name from public.trail_gifts tg join public.students s on s.id = tg.from_id
           where tg.to_id = p_run.student_id and not tg.claimed order by tg.id for update of tg loop
    st := jsonb_set(st, array['res', g.item], to_jsonb(coalesce((st->'res'->>g.item)::int, 0) + g.qty), true);
    update public.trail_gifts set claimed = true where id = g.id;
    out := out || jsonb_build_object('from', g.display_name, 'item', g.item, 'qty', g.qty);
  end loop;
  if jsonb_array_length(out) > 0 then update public.trail_runs set state = st, updated_at = now() where id = p_run.id; end if;
  return out;
end $$;

revoke all on function public._trail_left(uuid) from public, anon, authenticated;
revoke all on function public._trail_team(uuid, text) from public, anon, authenticated;
revoke all on function public._trail_claim(public.trail_runs) from public, anon, authenticated;

-- ---------- public ----------
-- everything the page needs on open
create or replace function public.trail_load(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.trail_runs; gifts jsonb := '[]'::jsonb;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.trail_runs where student_id = p_student_id and trimester = p_trimester and status = 'active';
  if found then gifts := public._trail_claim(r); select * into r from public.trail_runs where id = r.id; end if;
  return jsonb_build_object(
    'run', case when r.id is null then null else jsonb_build_object('id', r.id, 'run_no', r.run_no, 'miles', r.miles, 'state', r.state) end,
    'gifts', gifts, 'left_today', public._trail_left(p_student_id),
    'finished', (select count(*) from public.trail_runs where student_id = p_student_id and trimester = p_trimester and status = 'done'),
    'best', (select max(score) from public.trail_runs where student_id = p_student_id and trimester = p_trimester and status = 'done'),
    'team', public._trail_team(p_student_id, p_trimester));
end $$;

-- start a new journey (any active one is ended first). The daily mile cap carries over.
create or replace function public.trail_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.trail_runs; n int;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if pg_column_size(p_state) > 60000 then raise exception 'Save is too big'; end if;
  update public.trail_runs set status = 'over', finished_at = now(), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and status = 'active';
  select coalesce(max(run_no), 0) + 1 into n from public.trail_runs where student_id = p_student_id and trimester = p_trimester;
  insert into public.trail_runs (student_id, trimester, run_no, state) values (p_student_id, p_trimester, n, jsonb_set(p_state, '{miles}', '0'))
  returning * into r;
  return jsonb_build_object('id', r.id, 'run_no', r.run_no, 'miles', 0, 'state', r.state, 'left_today', public._trail_left(p_student_id));
end $$;

-- save after each trail day. Miles can only go up, and never past today's 200-mile allowance.
create or replace function public.trail_save(p_student_id uuid, p_pin_hash text, p_trimester text, p_run_id uuid, p_state jsonb, p_status text default 'active', p_score int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.trail_runs; want int; allowed int; gain int; st jsonb; gifts jsonb; sc int; res jsonb;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if pg_column_size(p_state) > 60000 then raise exception 'Save is too big'; end if;
  select * into r from public.trail_runs where id = p_run_id and student_id = p_student_id for update;
  if not found then raise exception 'Journey not found'; end if;
  if r.status <> 'active' then raise exception 'This journey is over'; end if;
  want := greatest(coalesce((p_state->>'miles')::int, r.miles), r.miles);
  allowed := greatest(public._trail_left(p_student_id), 0);
  gain := least(want - r.miles, allowed);
  if gain > 0 then
    insert into public.trail_daily (student_id, day, miles) values (p_student_id, public._trail_today(), gain)
    on conflict (student_id, day) do update set miles = trail_daily.miles + excluded.miles;
  end if;
  st := jsonb_set(p_state, '{miles}', to_jsonb(r.miles + gain));
  update public.trail_runs set state = st, miles = r.miles + gain, updated_at = now() where id = r.id returning * into r;
  gifts := public._trail_claim(r);
  select * into r from public.trail_runs where id = r.id;
  res := jsonb_build_object('miles', r.miles, 'state', r.state, 'gifts', gifts, 'left_today', public._trail_left(p_student_id), 'clamped', want > r.miles);

  if p_status = 'done' and r.miles >= 1200 then
    sc := least(greatest(coalesce(p_score, 0), 0), 5000);
    update public.trail_runs set status = 'done', score = sc, finished_at = now() where id = r.id;
    begin
      perform public.arcade_submit(p_student_id, p_pin_hash, p_trimester, 'wellness_trail', sc, true);
    exception when others then null;   -- the journey still counts even if the leaderboard post fails
    end;
    res := res || jsonb_build_object('status', 'done', 'score', sc);
  elsif p_status = 'over' then
    update public.trail_runs set status = 'over', finished_at = now() where id = r.id;
    res := res || jsonb_build_object('status', 'over');
  end if;
  return res;
end $$;

-- teams: up to 4 students, joined with a 4-letter code. Nobody can remove anyone but themselves (the teacher can).
create or replace function public.trail_team_create(p_student_id uuid, p_pin_hash text, p_trimester text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.trail_teams; c text; tries int := 0; nm text;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if exists (select 1 from public.trail_members where student_id = p_student_id and trimester = p_trimester and team_id is not null) then raise exception 'Leave your current convoy first'; end if;
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9 ''!-]', '', 'g')), 20);
  if nm = '' then nm := 'Convoy'; end if;
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '') from generate_series(1,4));
    begin
      insert into public.trail_teams (code, trimester, name) values (c, p_trimester, nm) returning * into t; exit;
    exception when unique_violation then tries := tries + 1; if tries > 20 then raise exception 'Try again'; end if;
    end;
  end loop;
  insert into public.trail_members (student_id, trimester, team_id) values (p_student_id, p_trimester, t.id)
  on conflict (student_id, trimester) do update set team_id = excluded.team_id, joined_at = now();
  return public._trail_team(p_student_id, p_trimester);
end $$;

create or replace function public.trail_team_join(p_student_id uuid, p_pin_hash text, p_trimester text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.trail_teams;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if exists (select 1 from public.trail_members where student_id = p_student_id and trimester = p_trimester and team_id is not null) then raise exception 'Leave your current convoy first'; end if;
  select * into t from public.trail_teams where trimester = p_trimester and code = upper(btrim(p_code)) for update;
  if not found then raise exception 'No convoy with that code'; end if;
  if (select count(*) from public.trail_members where team_id = t.id) >= 4 then raise exception 'That convoy is full (4 wagons)'; end if;
  insert into public.trail_members (student_id, trimester, team_id) values (p_student_id, p_trimester, t.id)
  on conflict (student_id, trimester) do update set team_id = excluded.team_id, joined_at = now();
  return public._trail_team(p_student_id, p_trimester);
end $$;

create or replace function public.trail_team_leave(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  update public.trail_members set team_id = null where student_id = p_student_id and trimester = p_trimester;
  return true;
end $$;

-- send supplies to a teammate. Comes out of YOUR saved supplies; can never take from anyone.
create or replace function public.trail_gift(p_student_id uuid, p_pin_hash text, p_trimester text, p_to uuid, p_item text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.trail_runs; have int; cap int;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  cap := case p_item when 'food' then 50 when 'water' then 5 when 'meds' then 2 when 'coins' then 50 else 0 end;
  if cap = 0 then raise exception 'You can send food, water, medicine or coins'; end if;
  if p_qty is null or p_qty < 1 or p_qty > cap then raise exception 'You can send up to % at a time', cap; end if;
  if p_to = p_student_id then raise exception 'Pick a teammate'; end if;
  if not exists (select 1 from public.trail_members a join public.trail_members b on a.team_id = b.team_id
                 where a.student_id = p_student_id and a.trimester = p_trimester and b.student_id = p_to) then
    raise exception 'They are not in your convoy'; end if;
  if (select count(*) from public.trail_gifts where from_id = p_student_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s plenty of gifts for today'; end if;
  select * into r from public.trail_runs where student_id = p_student_id and trimester = p_trimester and status = 'active' for update;
  if not found then raise exception 'Start your own journey to send supplies'; end if;
  have := coalesce((r.state->'res'->>p_item)::int, 0);
  if have < p_qty then raise exception 'You only have %', have; end if;
  update public.trail_runs set state = jsonb_set(state, array['res', p_item], to_jsonb(have - p_qty)), updated_at = now()
   where id = r.id returning * into r;
  insert into public.trail_gifts (from_id, to_id, item, qty) values (p_student_id, p_to, p_item, p_qty);
  return jsonb_build_object('state', r.state);
end $$;

-- a benched traveler leaves a marker with one of the preset tips; others see markers ahead of them
create or replace function public.trail_marker(p_student_id uuid, p_pin_hash text, p_trimester text, p_run_id uuid, p_tip int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.trail_runs; nm text;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.trail_runs where id = p_run_id and student_id = p_student_id;
  if not found then return false; end if;
  if (select count(*) from public.trail_markers where run_id = r.id) >= 4 then return false; end if;
  select split_part(display_name, ' ', 1) into nm from public.students where id = p_student_id;
  insert into public.trail_markers (trimester, run_id, miles, who, tip) values (p_trimester, r.id, r.miles, left(coalesce(nm, 'A traveler'), 16), greatest(0, least(coalesce(p_tip, 0), 39)));
  return true;
end $$;

create or replace function public.trail_markers_near(p_trimester text, p_from int, p_to int)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('miles', miles, 'who', who, 'tip', tip) order by miles), '[]'::jsonb)
  from (select * from public.trail_markers where trimester = p_trimester and miles between p_from and p_to order by created_at desc limit 30) m;
$$;

-- ---------- teacher ----------
create or replace function public.trail_teacher_teams(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'name', t.name,
            'members', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.display_name, 'class', s.class_code,
                         'miles', (select r.miles from public.trail_runs r where r.student_id = s.id and r.trimester = p_trimester and r.status = 'active'),
                         'finished', (select count(*) from public.trail_runs r where r.student_id = s.id and r.trimester = p_trimester and r.status = 'done'))
                         order by m.joined_at), '[]'::jsonb)
                        from public.trail_members m join public.students s on s.id = m.student_id where m.team_id = t.id))
          order by t.created_at), '[]'::jsonb)
          from public.trail_teams t where t.trimester = p_trimester);
end $$;

create or replace function public.trail_teacher_remove(p_teacher_pass text, p_student_id uuid, p_trimester text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'Wrong teacher passphrase'; end if;
  update public.trail_members set team_id = null where student_id = p_student_id and trimester = p_trimester and team_id is not null;
  return found;
end $$;

revoke all on function public.trail_load(uuid, text, text) from public;
revoke all on function public.trail_start(uuid, text, text, jsonb) from public;
revoke all on function public.trail_save(uuid, text, text, uuid, jsonb, text, int) from public;
revoke all on function public.trail_team_create(uuid, text, text, text) from public;
revoke all on function public.trail_team_join(uuid, text, text, text) from public;
revoke all on function public.trail_team_leave(uuid, text, text) from public;
revoke all on function public.trail_gift(uuid, text, text, uuid, text, int) from public;
revoke all on function public.trail_marker(uuid, text, text, uuid, int) from public;
revoke all on function public.trail_markers_near(text, int, int) from public;
revoke all on function public.trail_teacher_teams(text, text) from public;
revoke all on function public.trail_teacher_remove(text, uuid, text) from public;
grant execute on function public.trail_load(uuid, text, text) to anon, authenticated;
grant execute on function public.trail_start(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.trail_save(uuid, text, text, uuid, jsonb, text, int) to anon, authenticated;
grant execute on function public.trail_team_create(uuid, text, text, text) to anon, authenticated;
grant execute on function public.trail_team_join(uuid, text, text, text) to anon, authenticated;
grant execute on function public.trail_team_leave(uuid, text, text) to anon, authenticated;
grant execute on function public.trail_gift(uuid, text, text, uuid, text, int) to anon, authenticated;
grant execute on function public.trail_marker(uuid, text, text, uuid, int) to anon, authenticated;
grant execute on function public.trail_markers_near(text, int, int) to anon, authenticated;
grant execute on function public.trail_teacher_teams(text, text) to anon, authenticated;
grant execute on function public.trail_teacher_remove(text, uuid, text) to anon, authenticated;
