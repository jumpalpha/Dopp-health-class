-- ============================================================
-- Financial Health: "The Cost of Your Future" (finance.html). Safe to re-run.
--
-- Adds ONE new table and new functions. Nothing existing is altered or deleted.
-- Same pattern as the rest of the site: RLS on, no policies, the website only calls the
-- SECURITY DEFINER functions below. Students authenticate with id + PIN hash (like every
-- other project); the teacher with the dashboard passphrase (_teacher_ok).
--
-- What the database enforces (the page can't get around these):
--   * a student can only read/write their own row
--   * once Step 2 estimates are locked, they can never be changed again by the student
--   * once submitted, nothing can be changed until the teacher returns the assignment
--   * submitting twice does nothing (first submission time is kept)
--   * required fields are re-checked here at submission
--   * the optional screenshot must be a small JPEG (the page shrinks it first)
-- No XP is awarded by anything in this file.
--
-- It also writes small marker rows into student_project_data ('finance_quest' while working,
-- 'finance_quest_done' once submitted) so the existing Student Checklist can show status
-- without changing the checklist's database code.
--
-- Paste into Supabase > SQL Editor > New query > Run. Expected result: "Success. No rows returned".
-- ============================================================

create table if not exists public.finance_quest (
  student_id      uuid not null references public.students(id) on delete cascade,
  trimester       text not null,
  data            jsonb not null default '{}'::jsonb,   -- the student's working copy
  predicted       jsonb,                                -- Step 2 estimates, frozen at lock time
  pred_locked_at  timestamptz,
  evidence_img    text,                                 -- optional screenshot (small JPEG data URL)
  status          text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at    timestamptz,
  submitted_data  jsonb,                                -- exact copy of what was turned in
  returned_at     timestamptz,                          -- last time the teacher reopened it
  scores          jsonb,                                -- teacher's final rubric points
  teacher_note    text,
  scored_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (student_id, trimester)
);
alter table public.finance_quest enable row level security;

-- ---------- helpers ----------
create or replace function public._fin_keys() returns text[]
language sql immutable as $$
  select array['housing','healthcare','utilities','childcare','transportation','education',
               'clothing','entertainment','food','personal','misc','savings'];
$$;

-- a non-negative number, given as a JSON number or numeric string
create or replace function public._fin_money(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) in ('number', 'string')
     and (v #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
     and (v #>> '{}')::numeric <= 10000000;
$$;

-- sentences of 4+ words ending in . ! or ?  (same rule as the page)
create or replace function public._fin_sentences(t text) returns int
language sql immutable as $$
  select count(*)::int from regexp_matches(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'), '[^.!?]+[.!?]+', 'g') m
   where (select count(*) from regexp_split_to_table(btrim(m[1]), '\s+') w where w ~ '[A-Za-z0-9]') >= 4;
$$;

create or replace function public._fin_marker(p_student uuid, p_trimester text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.student_project_data (student_id, trimester, project_key, data, updated_at)
    values (p_student, p_trimester, case when p_status = 'submitted' then 'finance_quest_done' else 'finance_quest' end,
            jsonb_build_object('status', p_status), now())
    on conflict (student_id, trimester, project_key) do update set data = excluded.data, updated_at = now();
    if p_status <> 'submitted' then
      delete from public.student_project_data where student_id = p_student and trimester = p_trimester and project_key = 'finance_quest_done';
    end if;
  exception when others then null;   -- the checklist marker must never block saving
  end;
end $$;

-- what the student is allowed to see about their own row
create or replace function public._fin_view(r public.finance_quest) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'data', r.data, 'status', r.status, 'submitted_at', r.submitted_at, 'returned_at', r.returned_at,
    'pred_locked_at', r.pred_locked_at, 'updated_at', r.updated_at,
    'image', r.evidence_img,
    'scores', case when r.scored_at is not null then r.scores end,
    'teacher_note', case when r.scored_at is not null then r.teacher_note end);
$$;

revoke all on function public._fin_marker(uuid, text, text) from public, anon, authenticated;

-- ---------- student ----------
create or replace function public.fin_get(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.finance_quest;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.finance_quest where student_id = p_student_id and trimester = p_trimester;
  if not found then return null; end if;
  return public._fin_view(r);
end $$;

create or replace function public.fin_save(p_student_id uuid, p_pin_hash text, p_trimester text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.finance_quest; d jsonb := coalesce(p_data, '{}'::jsonb); k text; v_exists boolean;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if jsonb_typeof(d) <> 'object' or pg_column_size(d) > 60000 then raise exception 'Save is too large'; end if;
  d := d - 'image';                                          -- screenshots go through fin_image only

  select * into r from public.finance_quest where student_id = p_student_id and trimester = p_trimester for update;
  v_exists := found;                                         -- (loops below reset FOUND)
  if v_exists and r.status = 'submitted' then raise exception 'Already submitted. Ask Mr. Dopp to return it if you need to change something.'; end if;

  if v_exists and r.pred_locked_at is not null then
    -- estimates are frozen: whatever the page sent, keep the locked copy
    d := jsonb_set(d, '{predicted}', r.predicted);
    d := jsonb_set(d, '{predLockedAt}', to_jsonb(r.pred_locked_at));
  elsif d ? 'predLockedAt' and d->>'predLockedAt' is not null then
    -- the student is locking now: every estimate must be a real number
    foreach k in array public._fin_keys() loop
      if not public._fin_money(d->'predicted'->k) then raise exception 'Fill in every estimate (use 0 if none) before locking'; end if;
    end loop;
  end if;

  if not v_exists then
    insert into public.finance_quest (student_id, trimester, data) values (p_student_id, p_trimester, d) returning * into r;
  else
    update public.finance_quest set data = d, updated_at = now()
     where student_id = p_student_id and trimester = p_trimester returning * into r;
  end if;

  if r.pred_locked_at is null and d->>'predLockedAt' is not null then
    update public.finance_quest set predicted = d->'predicted', pred_locked_at = now(),
           data = jsonb_set(data, '{predLockedAt}', to_jsonb(now()))
     where student_id = p_student_id and trimester = p_trimester returning * into r;
  end if;

  perform public._fin_marker(p_student_id, p_trimester, 'draft');
  return jsonb_build_object('ok', true, 'updated_at', r.updated_at, 'pred_locked_at', r.pred_locked_at);
end $$;

-- p_img null removes the screenshot
create or replace function public.fin_image(p_student_id uuid, p_pin_hash text, p_trimester text, p_img text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.finance_quest;
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if p_img is not null then
    if length(p_img) > 700000 then raise exception 'Image is too large'; end if;
    if p_img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Image must be a JPEG'; end if;
  end if;
  select * into r from public.finance_quest where student_id = p_student_id and trimester = p_trimester for update;
  if found and r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not found then
    insert into public.finance_quest (student_id, trimester, evidence_img) values (p_student_id, p_trimester, p_img);
  else
    update public.finance_quest set evidence_img = p_img, updated_at = now() where student_id = p_student_id and trimester = p_trimester;
  end if;
  return jsonb_build_object('ok', true, 'has_image', p_img is not null);
end $$;

-- Submits what is already saved. Re-checks the required work. Submitting twice is harmless.
create or replace function public.fin_submit(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.finance_quest; d jsonb; k text; miss text[] := '{}';
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.finance_quest where student_id = p_student_id and trimester = p_trimester for update;
  if not found then raise exception 'Nothing saved yet'; end if;
  if r.status = 'submitted' then
    return jsonb_build_object('ok', true, 'already', true, 'submitted_at', r.submitted_at);
  end if;
  d := r.data;

  if coalesce(d->'step0'->>'quiz', '') = '' then miss := array_append(miss, 'interest question'::text); end if;
  if btrim(coalesce(d->'career'->>'job', '')) = '' then miss := array_append(miss, 'occupation'::text); end if;
  if not public._fin_money(d->'career'->'salary') or (d->'career'->>'salary')::numeric <= 0 then miss := array_append(miss, 'salary'::text); end if;
  if not public._fin_money(d->'career'->'days') or (d->'career'->>'days')::numeric not between 0.5 and 7 then miss := array_append(miss, 'days per week'::text); end if;
  if not public._fin_money(d->'career'->'hours') or (d->'career'->>'hours')::numeric not between 0.5 and 24 then miss := array_append(miss, 'hours per day'::text); end if;
  if btrim(coalesce(d->'career'->>'place', '')) = '' then miss := array_append(miss, 'where you plan to live'::text); end if;
  if r.pred_locked_at is null then miss := array_append(miss, 'locked estimates'::text); end if;
  if btrim(coalesce(d->'research'->>'location', '')) = '' then miss := array_append(miss, 'location researched'::text); end if;
  if btrim(coalesce(d->'research'->>'household', '')) = '' then miss := array_append(miss, 'household type'::text); end if;
  if coalesce(d->'research'->>'url', '') !~* '^\s*https?://\S+\.\S+' then miss := array_append(miss, 'source web address'::text); end if;
  if btrim(coalesce(d->'research'->>'date', '')) = '' then miss := array_append(miss, 'date researched'::text); end if;
  foreach k in array public._fin_keys() loop
    if not public._fin_money(d->'research'->'values'->k->'v') then miss := array_append(miss, ('researched ' || k)::text); end if;
  end loop;
  if public._fin_sentences(d->>'reflection') < 5 then miss := array_append(miss, '5 complete sentences'::text); end if;

  if array_length(miss, 1) > 0 then
    raise exception 'Still missing: %', array_to_string(miss, ', ');
  end if;

  update public.finance_quest
     set status = 'submitted', submitted_at = now(), submitted_data = d, updated_at = now()
   where student_id = p_student_id and trimester = p_trimester returning * into r;
  perform public._fin_marker(p_student_id, p_trimester, 'submitted');
  return jsonb_build_object('ok', true, 'submitted_at', r.submitted_at);
end $$;

-- ---------- teacher ----------
-- Whole class: everyone on the roster (except visitors), with their work if they started.
create or replace function public.fin_teacher_list(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'first', s.display_name, 'last', s.last_name, 'code', s.class_code,
            'status', coalesce(f.status, 'not_started'),
            'updated_at', f.updated_at, 'submitted_at', f.submitted_at, 'returned_at', f.returned_at,
            'pred_locked_at', f.pred_locked_at, 'has_image', f.evidence_img is not null,
            'data', (case when f.status = 'submitted' then f.submitted_data else f.data end) - 'whatif',
            'scores', f.scores, 'teacher_note', f.teacher_note, 'scored_at', f.scored_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
            from public.students s
            left join public.finance_quest f on f.student_id = s.id and f.trimester = p_trimester
           where s.trimester = p_trimester and s.class_code not ilike 'VISITOR%');
end $$;

create or replace function public.fin_teacher_image(p_teacher_pass text, p_trimester text, p_student uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return (select evidence_img from public.finance_quest where student_id = p_student and trimester = p_trimester);
end $$;

-- Final scores. Keys: career(10) predictions(15) research(25) calc(20) reflection(20) completion(10).
-- A key left null means "not graded yet".
create or replace function public.fin_teacher_score(p_teacher_pass text, p_trimester text, p_student uuid, p_scores jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lim jsonb := '{"career":10,"predictions":15,"research":25,"calc":20,"reflection":20,"completion":10}'; k text; v jsonb; clean jsonb := '{}';
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if jsonb_typeof(coalesce(p_scores, '{}'::jsonb)) <> 'object' then raise exception 'bad scores'; end if;
  for k in select jsonb_object_keys(lim) loop
    v := p_scores->k;
    if v is null or jsonb_typeof(v) = 'null' then clean := clean || jsonb_build_object(k, null);
    elsif jsonb_typeof(v) = 'number' and (v::text)::numeric between 0 and (lim->>k)::numeric then clean := clean || jsonb_build_object(k, v);
    else raise exception '% must be 0 to %', k, lim->>k; end if;
  end loop;
  update public.finance_quest set scores = clean, teacher_note = left(p_note, 1000), scored_at = now()
   where student_id = p_student and trimester = p_trimester;
  if not found then raise exception 'That student has not started this assignment'; end if;
  return jsonb_build_object('ok', true, 'scores', clean);
end $$;

-- Reopen a submitted assignment so the student can fix it and submit again. Keeps the
-- locked Step 2 estimates and the last submitted copy.
create or replace function public.fin_teacher_return(p_teacher_pass text, p_trimester text, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.finance_quest set status = 'draft', submitted_at = null, returned_at = now(), updated_at = now()
   where student_id = p_student and trimester = p_trimester and status = 'submitted';
  if not found then raise exception 'Nothing submitted to return'; end if;
  perform public._fin_marker(p_student, p_trimester, 'draft');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.fin_get(uuid, text, text) from public;
revoke all on function public.fin_save(uuid, text, text, jsonb) from public;
revoke all on function public.fin_image(uuid, text, text, text) from public;
revoke all on function public.fin_submit(uuid, text, text) from public;
revoke all on function public.fin_teacher_list(text, text) from public;
revoke all on function public.fin_teacher_image(text, text, uuid) from public;
revoke all on function public.fin_teacher_score(text, text, uuid, jsonb, text) from public;
revoke all on function public.fin_teacher_return(text, text, uuid) from public;
grant execute on function public.fin_get(uuid, text, text) to anon, authenticated;
grant execute on function public.fin_save(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.fin_image(uuid, text, text, text) to anon, authenticated;
grant execute on function public.fin_submit(uuid, text, text) to anon, authenticated;
grant execute on function public.fin_teacher_list(text, text) to anon, authenticated;
grant execute on function public.fin_teacher_image(text, text, uuid) to anon, authenticated;
grant execute on function public.fin_teacher_score(text, text, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.fin_teacher_return(text, text, uuid) to anon, authenticated;
