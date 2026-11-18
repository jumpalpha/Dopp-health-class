-- ============================================================
-- Reading Check — private reading-level screener. Safe to re-run. Added 2026-11-18.
--
-- • A student takes it from reading_check.html while signed in (student id + PIN hash).
-- • Results are PRIVATE: only that student (with their PIN) and the teacher (dashboard
--   passphrase, _teacher_ok) can read them. Nothing here feeds a leaderboard, badge, board,
--   roster, XP or anything other students can see.
-- • reading_checks has RLS on and no policies: only the functions below can touch it.
-- • Unlimited retakes (2026-11-18). Every attempt is kept; the newest is the current level.
-- • The demo account (students.is_demo) can take it, but nothing is saved.
-- ============================================================

create table if not exists public.reading_checks (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  trimester   text not null,
  taken_at    timestamptz not null default now(),
  level       int  not null check (level between 2 and 13),   -- 2 = below grade 3, 13 = college
  maze_pct    int  check (maze_pct between 0 and 100),
  sre_net     int,                                            -- speed round: correct − wrong in 60 s
  sre_acc     int  check (sre_acc between 0 and 100),
  minutes     numeric(5,1),
  flags       text[] not null default '{}',
  details     jsonb not null default '{}'::jsonb,
  retake_ok   boolean not null default false
);
create index if not exists reading_checks_student on public.reading_checks (student_id, trimester, taken_at desc);
alter table public.reading_checks enable row level security;   -- no policies on purpose
revoke all on public.reading_checks from anon, authenticated;

-- ---------- student ----------
create or replace function public._rc_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                  where s.id = p_student_id and s.pin_hash = p_pin_hash
                    and (s.trimester = p_trimester or s.permanent or s.is_demo));
$$;

create or replace function public.reading_status(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.reading_checks; n int;
begin
  if not public._rc_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.reading_checks
   where student_id = p_student_id and trimester = p_trimester order by taken_at desc limit 1;
  select count(*) into n from public.reading_checks where student_id = p_student_id and trimester = p_trimester;
  return jsonb_build_object(
    'attempts', n,
    'can_take', true,
    'latest', case when r.id is null then null else jsonb_build_object(
      'level', r.level, 'sre_net', r.sre_net, 'taken_at', r.taken_at, 'form', r.details->>'form') end);
end $$;

create or replace function public.reading_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  demo boolean; v_level int; v_flags text[];
begin
  if not public._rc_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 20000 then raise exception 'bad result'; end if;
  v_level := (p_result->>'level')::int;
  if v_level is null or v_level not between 2 and 13 then raise exception 'bad level'; end if;
  select coalesce(s.is_demo, false) into demo from public.students s where s.id = p_student_id;
  if demo then return jsonb_build_object('ok', true, 'saved', false); end if;   -- demo: nothing saved

  select coalesce(array_agg(x), '{}') into v_flags
    from (select left(jsonb_array_elements_text(coalesce(p_result->'flags', '[]'::jsonb)), 40) x limit 8) f;

  insert into public.reading_checks (student_id, trimester, level, maze_pct, sre_net, sre_acc, minutes, flags, details)
  values (p_student_id, p_trimester, v_level,
          case when p_result->>'maze_pct' is null then null else least(greatest((p_result->>'maze_pct')::int, 0), 100) end,
          (p_result->>'sre_net')::int,
          case when p_result->>'sre_acc' is null then null else least(greatest((p_result->>'sre_acc')::int, 0), 100) end,
          case when p_result->>'minutes' is null then null else least(greatest((p_result->>'minutes')::numeric, 0), 999) end,
          v_flags,
          coalesce(p_result->'details', '{}'::jsonb));
  return jsonb_build_object('ok', true, 'saved', true);
end $$;

-- ---------- teacher ----------
-- Every student in the trimester (no demo), with their latest attempt or null.
create or replace function public.reading_teacher_list(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', btrim(coalesce(s.display_name, '') || ' ' || coalesce(s.last_name, '')),
        'class_code', s.class_code,
        'attempts', (select count(*) from public.reading_checks c where c.student_id = s.id and c.trimester = p_trimester),
        'latest', (select jsonb_build_object('level', c.level, 'maze_pct', c.maze_pct, 'sre_net', c.sre_net, 'sre_acc', c.sre_acc,
                          'minutes', c.minutes, 'flags', c.flags, 'taken_at', c.taken_at, 'retake_ok', c.retake_ok, 'details', c.details)
                     from public.reading_checks c where c.student_id = s.id and c.trimester = p_trimester
                    order by c.taken_at desc limit 1),
        'history', (select coalesce(jsonb_agg(jsonb_build_object('level', c.level, 'sre_net', c.sre_net, 'sre_acc', c.sre_acc, 'maze_pct', c.maze_pct,
                            'minutes', c.minutes, 'flags', c.flags, 'taken_at', c.taken_at) order by c.taken_at), '[]'::jsonb)
                      from public.reading_checks c where c.student_id = s.id and c.trimester = p_trimester))
      order by s.class_code, lower(s.last_name), lower(s.display_name))
    from public.students s
   where s.trimester = p_trimester and not s.is_demo
     and not coalesce(public._is_visitor(s.class_code), false)), '[]'::jsonb);
end $$;

create or replace function public.reading_teacher_retake(p_teacher_pass text, p_trimester text, p_student_id uuid, p_allow boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.reading_checks set retake_ok = coalesce(p_allow, true)
   where id = (select id from public.reading_checks where student_id = p_student_id and trimester = p_trimester
                order by taken_at desc limit 1);
  return jsonb_build_object('ok', found);
end $$;

grant execute on function public.reading_status(uuid, text, text) to anon, authenticated;
grant execute on function public.reading_submit(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.reading_teacher_list(text, text) to anon, authenticated;
grant execute on function public.reading_teacher_retake(text, text, uuid, boolean) to anon, authenticated;
revoke execute on function public._rc_student_ok(uuid, text, text) from public, anon, authenticated;
