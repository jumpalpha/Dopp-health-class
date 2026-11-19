-- ============================================================
-- Exit Survey — end-of-trimester student feedback. Safe to re-run. Added 2026-11-19.
--
-- • Students take it from exit_survey.html (linked at the bottom of the home page,
--   page password "exit") while signed in (student id + PIN hash).
-- • One response per student per trimester; submitting again replaces their earlier answers.
-- • ANONYMOUS to the teacher: exit_survey_teacher_list returns class code + answers only,
--   never the student id or name. student_id is kept only to allow one response each.
-- • exit_surveys has RLS on and no policies: only the functions below can touch it.
-- • Demo account can take it, but nothing is saved.
-- ============================================================

create table if not exists public.exit_surveys (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  trimester   text not null,
  class_code  text,
  answers     jsonb not null default '{}'::jsonb,   -- { "q1": "A", ... }
  comments    jsonb not null default '{}'::jsonb,   -- { "q1": "text", ..., "final": "text" }
  submitted_at timestamptz not null default now(),
  unique (student_id, trimester)
);
alter table public.exit_surveys enable row level security;   -- no policies on purpose
revoke all on public.exit_surveys from anon, authenticated;

create or replace function public._es_student_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                  where s.id = p_student_id and s.pin_hash = p_pin_hash
                    and (s.trimester = p_trimester or s.permanent or s.is_demo));
$$;

create or replace function public.exit_survey_status(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.exit_surveys;
begin
  if not public._es_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  select * into r from public.exit_surveys where student_id = p_student_id and trimester = p_trimester;
  return jsonb_build_object('done', r.id is not null, 'submitted_at', r.submitted_at,
                            'answers', coalesce(r.answers, '{}'::jsonb), 'comments', coalesce(r.comments, '{}'::jsonb));
end $$;

create or replace function public.exit_survey_submit(p_student_id uuid, p_pin_hash text, p_trimester text,
                                                     p_answers jsonb, p_comments jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare demo boolean; code text; k text; v text; clean_a jsonb := '{}'; clean_c jsonb := '{}';
begin
  if not public._es_student_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_answers) <> 'object' or jsonb_typeof(coalesce(p_comments, '{}'::jsonb)) <> 'object'
     or pg_column_size(p_answers) + pg_column_size(p_comments) > 40000 then raise exception 'bad survey'; end if;
  for k, v in select key, value from jsonb_each_text(p_answers) loop
    if k ~ '^q([1-9]|1[0-9]|20)$' and v in ('A','B','C','D') then clean_a := clean_a || jsonb_build_object(k, v); end if;
  end loop;
  if (select count(*) from jsonb_object_keys(clean_a)) < 20 then raise exception 'please answer every question'; end if;
  for k, v in select key, value from jsonb_each_text(coalesce(p_comments, '{}'::jsonb)) loop
    if (k ~ '^q([1-9]|1[0-9]|20)$' or k = 'final') and btrim(v) <> '' then
      clean_c := clean_c || jsonb_build_object(k, left(btrim(v), 1500));
    end if;
  end loop;
  select coalesce(s.is_demo, false), s.class_code into demo, code from public.students s where s.id = p_student_id;
  if demo then return jsonb_build_object('ok', true, 'saved', false); end if;
  insert into public.exit_surveys (student_id, trimester, class_code, answers, comments)
  values (p_student_id, p_trimester, code, clean_a, clean_c)
  on conflict (student_id, trimester) do update
     set answers = excluded.answers, comments = excluded.comments, class_code = excluded.class_code, submitted_at = now();
  return jsonb_build_object('ok', true, 'saved', true);
end $$;

-- Teacher: every response for a trimester, anonymous (no id, no name), shuffled order.
create or replace function public.exit_survey_teacher_list(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'trimesters', coalesce((select jsonb_agg(distinct trimester) from public.exit_surveys), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg(jsonb_build_object('class_code', e.class_code, 'answers', e.answers,
                                   'comments', e.comments, 'day', e.submitted_at::date) order by md5(e.id::text))
                            from public.exit_surveys e where e.trimester = p_trimester), '[]'::jsonb));
end $$;

grant execute on function public.exit_survey_status(uuid, text, text) to anon, authenticated;
grant execute on function public.exit_survey_submit(uuid, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.exit_survey_teacher_list(text, text) to anon, authenticated;
revoke execute on function public._es_student_ok(uuid, text, text) from public, anon, authenticated;
