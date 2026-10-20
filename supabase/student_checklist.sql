-- ============================================================
-- Student Trimester Checklist (TEACHER DRAFT). Safe to re-run.
--
-- Adds new tables only. Nothing existing is altered or deleted, except:
--   * a trigger on student_pets that copies each day's sprite care counts into
--     pet_care_days (so care can be counted across the whole trimester). The trigger
--     never blocks a sprite action: any error inside it is swallowed.
--
-- Same pattern as the rest of the site: RLS on, no policies, the website only calls
-- the SECURITY DEFINER functions below. Students authenticate with id + PIN hash;
-- the teacher with the dashboard passphrase.
--
-- Evidence written here:
--   checklist_events  kind 'read'  : one row per chapter-reader lesson section actually read
--                     kind 'vocab' : one row per (chapter, vocab mode) round finished for real
--   pet_care_days     : per student per Denver day — habit kinds logged + chapter questions
--   checklist_manual  : the ONLY two student-controlled boxes (Schoology homework, off-site test)
--   checklist_verify  : teacher confirmations / excusals for items the site cannot see
--   checklist_config  : teacher settings (dates, homework/test map, minimums, released flag)
-- No XP is ever awarded by anything in this file.
-- ============================================================

create table if not exists public.checklist_events (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  kind       text not null check (kind in ('read', 'vocab')),
  chapter    int  not null check (chapter between 1 and 28),
  item       text not null,
  n          int  not null default 1,
  meta       jsonb not null default '{}'::jsonb,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (student_id, trimester, kind, chapter, item)
);
alter table public.checklist_events enable row level security;

create table if not exists public.checklist_manual (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  key        text not null,
  checked    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (student_id, trimester, key)
);
alter table public.checklist_manual enable row level security;

create table if not exists public.checklist_verify (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  item       text not null,
  status     text not null check (status in ('done', 'excused')),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (student_id, trimester, item)
);
alter table public.checklist_verify enable row level security;

create table if not exists public.checklist_config (
  trimester  text primary key,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.checklist_config enable row level security;

create table if not exists public.pet_care_days (
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  day        date not null,
  habits     int  not null default 0,     -- distinct healthy habits logged that day (self-logged)
  quiz       int  not null default 0,     -- chapter questions answered right that day
  backfill   boolean not null default false,
  primary key (student_id, trimester, day)
);
alter table public.pet_care_days enable row level security;

-- ---------- sprite care history (trigger; does not change pet_action) ----------
create or replace function public._pet_care_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare h int; q int;
begin
  begin
    if new.day_date is null then return new; end if;
    select count(*) into h from unnest(array['meal','water','sleep','exercise','relax','hygiene']) k
     where coalesce((new.day_counts->>k)::int, 0) > 0;
    q := coalesce((new.day_counts->>'quiz')::int, 0);
    if h = 0 and q = 0 then return new; end if;
    insert into public.pet_care_days (student_id, trimester, day, habits, quiz)
    values (new.student_id, new.trimester, new.day_date, h, q)
    on conflict (student_id, trimester, day)
      do update set habits = greatest(pet_care_days.habits, excluded.habits),
                    quiz = greatest(pet_care_days.quiz, excluded.quiz), backfill = false;
  exception when others then null;     -- never block a sprite action
  end;
  return new;
end $$;
revoke all on function public._pet_care_log() from public, anon, authenticated;

drop trigger if exists pet_care_log on public.student_pets;
create trigger pet_care_log after insert or update of day_counts, day_date on public.student_pets
for each row execute function public._pet_care_log();

-- One-time backfill from what already exists: today's counts, plus the days the current
-- streak proves (each streak day had 3+ habits). Marked backfill = true.
insert into public.pet_care_days (student_id, trimester, day, habits, quiz, backfill)
select p.student_id, p.trimester, d::date, 3, 0, true
  from public.student_pets p,
       generate_series(p.streak_date - (greatest(p.streak, 1) - 1), p.streak_date, interval '1 day') d
 where p.streak_date is not null and p.streak > 0
on conflict do nothing;
insert into public.pet_care_days (student_id, trimester, day, habits, quiz, backfill)
select p.student_id, p.trimester, p.day_date,
       (select count(*) from unnest(array['meal','water','sleep','exercise','relax','hygiene']) k
         where coalesce((p.day_counts->>k)::int, 0) > 0)::int,
       coalesce((p.day_counts->>'quiz')::int, 0), true
  from public.student_pets p where p.day_date is not null
on conflict (student_id, trimester, day)
  do update set habits = greatest(pet_care_days.habits, excluded.habits), quiz = greatest(pet_care_days.quiz, excluded.quiz);

-- ---------- helpers ----------
create or replace function public._cl_released(p_trimester text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (config->>'released')::boolean from public.checklist_config where trimester = p_trimester), false);
$$;

-- students may use the checklist only after release, except TEST-class accounts (for review)
create or replace function public._cl_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester
                   and (public._cl_released(p_trimester) or s.class_code ilike 'TEST%'));
$$;

-- everything the checklist knows about one student (raw evidence; the page decides status)
create or replace function public._cl_bundle(p_student uuid, p_trimester text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb; d0 date; d1 date;
begin
  select config into cfg from public.checklist_config where trimester = p_trimester;
  -- school-year defaults (teacher can change them in the checklist settings)
  d0 := coalesce((cfg->>'start')::date, case p_trimester when '2026-T2' then date '2026-12-01'
                                                         when '2026-T3' then date '2027-03-08' else date '2026-09-02' end);
  d1 := coalesce((cfg->>'end')::date,   case p_trimester when '2026-T2' then date '2027-03-05'
                                                         when '2026-T3' then date '2027-06-03' else date '2026-11-20' end);
  return jsonb_build_object(
    'reads', (select coalesce(jsonb_agg(jsonb_build_object('c', chapter, 'i', item, 'n', n, 'at', first_at)), '[]')
                from public.checklist_events where student_id = p_student and trimester = p_trimester and kind = 'read'),
    'vocab', (select coalesce(jsonb_agg(jsonb_build_object('c', chapter, 'm', item, 'n', n, 'meta', meta, 'at', last_at)), '[]')
                from public.checklist_events where student_id = p_student and trimester = p_trimester and kind = 'vocab'),
    'mastery', (select coalesce(jsonb_agg(x), '[]') from (
                  select jsonb_build_object('c', chapter, 'passed', bool_or(passed is true),
                         'attempts', count(*) filter (where finished_at is not null),
                         'fails', count(*) filter (where finished_at is not null and passed is not true),
                         'best', max(correct) filter (where finished_at is not null),
                         'first_fail', min(finished_at) filter (where passed is not true and finished_at is not null),
                         'last', max(finished_at)) x
                    from public.mastery_attempts where student_id = p_student and trimester = p_trimester group by chapter) t),
    'arcade', (select coalesce(jsonb_agg(jsonb_build_object('g', game, 'plays', plays, 'best', best, 'wins', wins)), '[]')
                 from public.arcade_scores where student_id = p_student and trimester = p_trimester),
    'trail', jsonb_build_object(
        'days', (select coalesce(jsonb_agg(day order by day), '[]') from public.trail_daily
                  where student_id = p_student and miles > 0 and day between d0 and d1),
        'finished', (select count(*) from public.trail_runs where student_id = p_student and trimester = p_trimester and status = 'done'),
        'miles', (select coalesce(max(miles), 0) from public.trail_runs where student_id = p_student and trimester = p_trimester)),
    'pet', (select jsonb_build_object('born', born_at, 'alive', alive, 'care_points', care_points,
                                      'streak', streak, 'best_streak', best_streak)
              from public.student_pets where student_id = p_student and trimester = p_trimester),
    'care', (select coalesce(jsonb_agg(jsonb_build_object('d', day, 'h', habits, 'q', quiz, 'b', backfill) order by day), '[]')
               from public.pet_care_days where student_id = p_student and trimester = p_trimester),
    'live', (select coalesce(jsonb_agg(x order by x->>'at'), '[]') from (
               select jsonb_build_object('s', ls.id, 't', ls.game_type, 'at', ls.created_at,
                      'answered', count(la.q_index), 'correct', count(la.q_index) filter (where la.is_correct)) x
                 from public.live_players lp join public.live_sessions ls on ls.id = lp.session_id
                 left join public.live_answers la on la.player_id = lp.id and la.session_id = ls.id
                where lp.student_id = p_student and ls.created_at::date between d0 and d1
                group by ls.id) t),
    'xp', jsonb_build_object(
        'verified', (select coalesce(jsonb_object_agg(source, s), '{}') from (
                       select source, sum(xp)::int s from public.xp_events
                        where student_id = p_student and trimester = p_trimester group by source) v),
        'quest_tasks', (select count(*) from public.quest_progress where student_id = p_student),
        'quest_days', (select count(*) from public.active_days ad
                        where ad.student_id = p_student and public._real_day(ad.student_id, ad.day_date))),
    'quest', (select coalesce(jsonb_agg(task_key), '[]') from public.quest_progress where student_id = p_student),
    'manual', (select coalesce(jsonb_object_agg(key, jsonb_build_object('on', checked, 'at', updated_at)), '{}')
                 from public.checklist_manual where student_id = p_student and trimester = p_trimester),
    'verify', (select coalesce(jsonb_object_agg(item, status), '{}')
                 from public.checklist_verify where student_id = p_student and trimester = p_trimester),
    'bonus', jsonb_build_object(
        'wcq', (select jsonb_build_object('stage', stage_completed, 'submitted', is_submitted)
                  from public.weight_control_quest_progress where student_id = p_student and trimester = p_trimester limit 1),
        'projects', (select coalesce(jsonb_agg(project_key), '[]') from public.student_project_data
                      where student_id = p_student and trimester = p_trimester))
  );
end $$;

revoke all on function public._cl_released(text) from public, anon, authenticated;
revoke all on function public._cl_student_ok(uuid, text, text) from public, anon, authenticated;
revoke all on function public._cl_bundle(uuid, text) from public, anon, authenticated;

-- ---------- student: record evidence (works for every signed-in student, release or not) ----------
-- Silent: the chapter reader and vocab games call this. It only records; it never awards XP.
create or replace function public.cl_log(p_student_id uuid, p_pin_hash text, p_trimester text,
                                         p_kind text, p_chapter int, p_item text, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tot int; ans int; cor int; ms int; sec int; pct int; m jsonb := coalesce(p_meta, '{}'::jsonb); r public.checklist_events;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if p_chapter is null or p_chapter < 1 or p_chapter > 28 then raise exception 'bad chapter'; end if;
  if pg_column_size(m) > 2000 then raise exception 'too big'; end if;

  if p_kind = 'read' then
    if p_item !~ '^s([1-9]|1[0-9])$' then raise exception 'bad section'; end if;
    sec := coalesce((m->>'sec')::int, 0);
    if sec < 10 then raise exception 'not read long enough'; end if;
    m := jsonb_build_object('sec', sec, 'of', least(greatest(coalesce((m->>'of')::int, 0), 0), 19));
  elsif p_kind = 'vocab' then
    if p_item not in ('flashcard', 'speedquiz', 'wordbuild', 'conceptmap') then raise exception 'bad mode'; end if;
    tot := coalesce((m->>'total')::int, 0); ans := coalesce((m->>'answered')::int, 0);
    cor := coalesce((m->>'correct')::int, 0); ms := coalesce((m->>'ms')::int, 0);
    if tot < 4 or tot > 80 or ans > tot or cor > ans or cor < 0 then raise exception 'bad round'; end if;
    if ans * 10 < tot * 8 then raise exception 'round not finished'; end if;          -- 80% really answered
    if ms < ans * 1200 then raise exception 'round too fast'; end if;                   -- ~1.2 s per answer minimum
    if cor * 10 < tot * 7 then raise exception 'score below 70%%'; end if;      -- 2026-10-20: need 70%% correct
    pct := (cor * 100) / tot;
    m := jsonb_build_object('total', tot, 'answered', ans, 'correct', cor, 'pct', pct);
  else
    raise exception 'bad kind';
  end if;

  select * into r from public.checklist_events
   where student_id = p_student_id and trimester = p_trimester and kind = p_kind and chapter = p_chapter and item = p_item
   for update;
  if r.student_id is null then
    insert into public.checklist_events (student_id, trimester, kind, chapter, item, meta)
    values (p_student_id, p_trimester, p_kind, p_chapter, p_item,
            case when p_kind = 'vocab' then m || jsonb_build_object('first_pct', pct, 'best_pct', pct) else m end)
    returning * into r;
  elsif r.last_at > now() - interval '5 seconds' then
    return jsonb_build_object('ok', true, 'n', r.n, 'dup', true);                      -- repeat event, no double count
  else
    update public.checklist_events set n = n + 1, last_at = now(),
           meta = case when p_kind = 'vocab'
                       then r.meta || m || jsonb_build_object('best_pct', greatest(coalesce((r.meta->>'best_pct')::int, 0), pct),
                                                              'first_pct', coalesce((r.meta->>'first_pct')::int, pct))
                       else r.meta end
     where student_id = r.student_id and trimester = r.trimester and kind = r.kind and chapter = r.chapter and item = r.item
    returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'n', r.n);
end $$;

-- ---------- student: the two student-reported boxes (after release; TEST accounts any time) ----------
create or replace function public.cl_manual_set(p_student_id uuid, p_pin_hash text, p_trimester text, p_key text, p_checked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._cl_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Checklist is not open yet'; end if;
  if p_key !~ '^(hw:ch([1-9]|1[0-6])|test:[a-z0-9_-]{1,20})$' then raise exception 'bad item'; end if;
  insert into public.checklist_manual (student_id, trimester, key, checked) values (p_student_id, p_trimester, p_key, coalesce(p_checked, false))
  on conflict (student_id, trimester, key) do update set checked = excluded.checked, updated_at = now();
  return jsonb_build_object('ok', true, 'key', p_key, 'on', coalesce(p_checked, false));
end $$;

-- ---------- student: own checklist (after release; TEST accounts any time) ----------
create or replace function public.cl_student(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb;
begin
  if not public._cl_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Checklist is not open yet'; end if;
  select config into cfg from public.checklist_config where trimester = p_trimester;
  cfg := coalesce(cfg, '{}'::jsonb) - 'excused';                                         -- never show other students' excusals
  return jsonb_build_object('config', cfg, 'evidence', public._cl_bundle(p_student_id, p_trimester));
end $$;

-- ---------- teacher ----------
create or replace function public.cl_teacher_config_get(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return coalesce((select config from public.checklist_config where trimester = p_trimester), '{}'::jsonb);
end $$;

create or replace function public.cl_teacher_config_set(p_teacher_pass text, p_trimester text, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_config) <> 'object' or pg_column_size(p_config) > 200000 then raise exception 'bad settings'; end if;
  insert into public.checklist_config (trimester, config) values (p_trimester, p_config)
  on conflict (trimester) do update set config = excluded.config, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cl_teacher_roster(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'first', display_name, 'last', last_name, 'code', class_code)
                                    order by class_code, last_name, display_name), '[]')
            from public.students where trimester = p_trimester and class_code not ilike 'VISITOR%');
end $$;

-- p_student null = whole class (object keyed by student id)
create or replace function public.cl_teacher_evidence(p_teacher_pass text, p_trimester text, p_student uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if p_student is not null then return public._cl_bundle(p_student, p_trimester); end if;
  return (select coalesce(jsonb_object_agg(id, public._cl_bundle(id, p_trimester)), '{}')
            from public.students where trimester = p_trimester and class_code not ilike 'VISITOR%');
end $$;

-- teacher confirmation / excusal; p_status null removes it
create or replace function public.cl_teacher_verify(p_teacher_pass text, p_trimester text, p_student uuid, p_item text, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if p_item !~ '^[a-z0-9:_.-]{1,60}$' then raise exception 'bad item'; end if;
  if p_status is null then
    delete from public.checklist_verify where student_id = p_student and trimester = p_trimester and item = p_item;
  else
    if p_status not in ('done', 'excused') then raise exception 'bad status'; end if;
    insert into public.checklist_verify (student_id, trimester, item, status, note) values (p_student, p_trimester, p_item, p_status, left(p_note, 200))
    on conflict (student_id, trimester, item) do update set status = excluded.status, note = excluded.note, updated_at = now();
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- lets the teacher flip a TEST-class account's student-reported boxes while reviewing the draft
create or replace function public.cl_teacher_manual_test(p_teacher_pass text, p_trimester text, p_student uuid, p_key text, p_checked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.students where id = p_student and trimester = p_trimester and class_code ilike 'TEST%') then
    raise exception 'Only TEST-class accounts can be used for this';
  end if;
  if p_key !~ '^(hw:ch([1-9]|1[0-6])|test:[a-z0-9_-]{1,20})$' then raise exception 'bad item'; end if;
  insert into public.checklist_manual (student_id, trimester, key, checked) values (p_student, p_trimester, p_key, coalesce(p_checked, false))
  on conflict (student_id, trimester, key) do update set checked = excluded.checked, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.cl_log(uuid, text, text, text, int, text, jsonb) to anon, authenticated;
grant execute on function public.cl_manual_set(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.cl_student(uuid, text, text) to anon, authenticated;
grant execute on function public.cl_teacher_config_get(text, text) to anon, authenticated;
grant execute on function public.cl_teacher_config_set(text, text, jsonb) to anon, authenticated;
grant execute on function public.cl_teacher_roster(text, text) to anon, authenticated;
grant execute on function public.cl_teacher_evidence(text, text, uuid) to anon, authenticated;
grant execute on function public.cl_teacher_verify(text, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.cl_teacher_manual_test(text, text, uuid, text, boolean) to anon, authenticated;
