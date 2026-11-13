-- Classwork v6 (run after classwork_v5.sql). Safe to re-run.
-- Grading Time posts the Unit Test score to its own Schoology assignment; record what was posted so the dashboard shows it.
alter table public.cw_work add column if not exists posted_unit_score int;
alter table public.cw_work add column if not exists posted_unit_at timestamptz;

create or replace function public.cw_teacher_list(p_teacher_pass text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object('live', (select live from public.cw_live where id = 1),
    'chapters', to_jsonb(public._cw_chapters(p_unit)),
    'terms', (select jsonb_agg(jsonb_build_object('n', n, 'term', term) order by n) from public.cw_terms where unit = p_unit),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'first', s.display_name, 'last', s.last_name, 'code', s.class_code,
            'status', coalesce(w.status, 'not_started'), 'learn_best', w.learn_best, 'learn_avg', public._cw_learn_avg(p_unit, coalesce(w.learn_grade, '{}')),
            'ch_test', w.ch_test, 'ch_stories', w.ch_stories, 'swapped', w.swapped,
            'story_avg', public._cw_avg2(p_unit, coalesce(w.ch_stories, '{}')), 'unit_best', w.unit_best, 'unit_tries', w.unit_tries,
            'final_score', w.final_score, 'submitted_at', w.submitted_at, 'updated_at', w.updated_at,
            'posted_score', w.posted_score, 'posted_at', w.posted_at,
            'posted_unit_score', w.posted_unit_score, 'posted_unit_at', w.posted_unit_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
            from public.students s
            left join public.cw_work w on w.student_id = s.id and w.trimester = p_trimester and w.unit = p_unit
           where s.trimester = p_trimester and s.class_code not ilike 'VISITOR%'));
end $$;
