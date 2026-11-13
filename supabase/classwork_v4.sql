-- Classwork v4 (run after classwork_v3.sql). Safe to re-run.
--  * Learn grade = average of ALL attempts per chapter (best score still unlocks the next chapter).
--  * Missed answers: the right answer is shown only after a pass (80%) or 3 tries. Reasoning-question answers are never shown.
--  * 15-minute cooldown between attempts of the same Learn, Chapter Test or Unit Test.
alter table public.cw_work add column if not exists learn_sum  jsonb not null default '{}';
alter table public.cw_work add column if not exists learn_grade jsonb not null default '{}';
alter table public.cw_work add column if not exists last_try  jsonb not null default '{}';
-- existing work: no per-attempt history, so start the average from the best score
update public.cw_work set learn_grade = learn_best,
       learn_sum = (select coalesce(jsonb_object_agg(k, (v::text)::int * coalesce((learn_tries->>k)::int, 1)), '{}') from jsonb_each(learn_best) e(k, v))
 where learn_grade = '{}' and learn_best <> '{}';

create or replace function public._cw_cooldown() returns int language sql immutable as $$ select 15 * 60 $$;
-- seconds left before this attempt can start (0 = go)
create or replace function public._cw_wait(p_last jsonb, p_key text) returns int language sql stable as $$
  select greatest(0, ceil(public._cw_cooldown() - extract(epoch from now() - (p_last->>p_key)::timestamptz)))::int
   where p_last ? p_key
  union all select 0 limit 1;
$$;


create or replace function public._cw_view(r public.cw_work) returns jsonb language sql stable as $$
  select jsonb_build_object('unit', r.unit, 'status', r.status, 'submitted_at', r.submitted_at, 'returned_at', r.returned_at,
    'learn_best', r.learn_best, 'learn_tries', r.learn_tries, 'ch_test', r.ch_test, 'ch_stories', r.ch_stories,
    'swapped', r.swapped, 'story_open', r.story_open, 'unit_best', r.unit_best, 'unit_tries', r.unit_tries,
    'learn_avg', public._cw_learn_avg(r.unit, r.learn_grade), 'story_avg', public._cw_avg2(r.unit, r.ch_stories),
    'final_score', case when r.status = 'submitted' then r.final_score
                        when public._cw_avg2(r.unit, r.ch_stories) is not null
                        then round((public._cw_learn_avg(r.unit, r.learn_grade) + public._cw_avg2(r.unit, r.ch_stories)) / 2.0)::int end,
    'chapters', to_jsonb(public._cw_chapters(r.unit)),
    'learn_open', r.learn_key ->> 'ch', 'learn_grade', r.learn_grade, 'last_try', r.last_try, 'cooldown', public._cw_cooldown(), 'now', now(), 'test_open', r.test_key ->> 'kind');
$$;

create or replace function public.cw_learn_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; words int[]; defs jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not public._cw_ch_open(p_unit, r.learn_best, p_ch) then raise exception 'Finish Learn in the earlier chapter first'; end if;
  if public._cw_wait(r.last_try, 'L' || p_ch) > 0 then
    raise exception '%', format('You can retake Learn for Chapter %s in %s min. Review the flashcards while you wait.', p_ch, ceil(public._cw_wait(r.last_try, 'L' || p_ch) / 60.0));
  end if;
  select array_agg(n order by random()) into words from public.cw_terms where unit = p_unit and chapter = p_ch;
  -- definitions: this chapter's own + up to 6 from the chapters just before / after (any unit)
  select jsonb_agg(jsonb_build_array(u, n, def) order by random()) into defs from (
    select unit u, n, def from public.cw_terms where unit = p_unit and chapter = p_ch
    union all
    (select unit, n, def from public.cw_terms
      where chapter in (p_ch - 1, p_ch + 1, p_ch - 2, p_ch + 2) and def not in (select def from public.cw_terms where unit = p_unit and chapter = p_ch)
      order by random() limit public._cw_rule('extra_defs'))) d;
  update public.cw_work set learn_key = jsonb_build_object('ch', p_ch, 'words', to_jsonb(words),
           'defs', (select jsonb_agg(jsonb_build_array(e->0, e->1)) from jsonb_array_elements(defs) e)), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit;
  return jsonb_build_object('chapter', p_ch,
    'words', (select jsonb_agg(t.term order by array_position(words, t.n)) from public.cw_terms t where t.unit = p_unit and t.n = any(words)),
    'defs', (select jsonb_agg(e->2) from jsonb_array_elements(defs) e));
end $$;

create or replace function public.cw_learn_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tries int; sm int; reveal boolean; r public.cw_work; k jsonb; ch int; i int := 0; w int; pick int; right_n int := 0; total int; score int; misses jsonb := '[]'; d jsonb; best int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  k := r.learn_key; if k is null then raise exception 'Start Learn first'; end if;
  ch := (k->>'ch')::int; total := jsonb_array_length(k->'words');
  for w in select (x)::int from jsonb_array_elements_text(k->'words') x loop
    pick := case when jsonb_typeof(p_answers->i) = 'number' then (p_answers->>i)::int else -1 end;
    d := k->'defs'->pick;
    if d is not null and (d->>0)::int = p_unit and (d->>1)::int = w then right_n := right_n + 1;
    else misses := misses || jsonb_build_array(jsonb_build_object('i', i,
           'term', (select term from public.cw_terms where unit = p_unit and n = w),
           'def',  (select def  from public.cw_terms where unit = p_unit and n = w)));
    end if;
    i := i + 1;
  end loop;
  score := round(100.0 * right_n / greatest(total, 1))::int;
  best := greatest(coalesce((r.learn_best->>(ch::text))::int, 0), score);
  tries := coalesce((r.learn_tries->>(ch::text))::int, 0) + 1;
  sm := coalesce((r.learn_sum->>(ch::text))::int, 0) + score;
  reveal := best >= public._cw_rule('learn_pass') or tries >= 3;
  if not reveal then
    select coalesce(jsonb_agg(m - 'def'), '[]') into misses from jsonb_array_elements(misses) m;
  end if;
  update public.cw_work set learn_key = null,
         learn_sum = learn_sum || jsonb_build_object(ch::text, sm),
         learn_grade = learn_grade || jsonb_build_object(ch::text, round(sm::numeric / tries)::int),
         last_try = last_try || jsonb_build_object('L' || ch, now()),
         learn_best = learn_best || jsonb_build_object(ch::text, best),
         learn_tries = learn_tries || jsonb_build_object(ch::text, coalesce((learn_tries->>(ch::text))::int, 0) + 1),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('chapter', ch, 'score', score, 'right', right_n, 'total', total, 'best', best,
                            'passed', best >= public._cw_rule('learn_pass'), 'misses', misses, 'reveal', reveal, 'tries', tries, 'grade', round(sm::numeric / tries)::int, 'work', public._cw_view(r));
end $$;

create or replace function public.cw_test_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; chs int[]; ids text[]; nr int := public._cw_rule('reason_n'); n int := public._cw_rule('quiz_n');
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if p_ch is null then
    if r.status <> 'submitted' and (not public._cw_all_learned(p_unit, r.learn_best) or public._cw_avg2(p_unit, r.ch_stories) is null) then
      raise exception 'Finish Learn and the stories in every chapter first';
    end if;
    chs := public._cw_chapters(p_unit);
  else
    if not public._cw_ch_open(p_unit, r.learn_best, p_ch) or not public._cw_learn_ok(p_unit, r.learn_best, p_ch) then
      raise exception 'Pass Learn (80%%) for this chapter first'; end if;
    chs := array[p_ch];
  end if;
  if public._cw_wait(r.last_try, coalesce('T' || p_ch, 'U')) > 0 then
    raise exception '%', format('You can retake this test in %s min. Review your missed questions while you wait.', ceil(public._cw_wait(r.last_try, coalesce('T' || p_ch, 'U')) / 60.0));
  end if;
  select array_agg(id) into ids from (
    (select id from public.cw_bank where chapter = any(chs) and kind = 'reason' order by random() limit nr)) a;
  ids := coalesce(ids, '{}');
  ids := ids || array(select id from public.cw_bank where chapter = any(chs) and kind = 'recall' and id <> all(ids)
                       order by random() limit n - coalesce(array_length(ids, 1), 0));
  select array_agg(x order by random()) into ids from unnest(ids) x;
  update public.cw_work set test_key = jsonb_build_object('kind', case when p_ch is null then 'unit' else 'ch' end, 'ch', p_ch, 'ids', to_jsonb(ids)),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit;
  return jsonb_build_object('kind', case when p_ch is null then 'unit' else 'ch' end, 'chapter', p_ch, 'ids', to_jsonb(ids));
end $$;

create or replace function public.cw_test_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare reveal boolean; r public.cw_work; k jsonb; i int := 0; qid text; right_n int := 0; total int; score int; misses jsonb := '[]'; ans text; best int; cur jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  k := r.test_key; if k is null then raise exception 'Start the test first'; end if;
  total := jsonb_array_length(k->'ids');
  for qid in select x from jsonb_array_elements_text(k->'ids') x loop
    ans := p_answers->>i;
    if ans is not null and left(md5(lower(btrim(ans))), 12) = (select h from public.cw_bank where id = qid) then right_n := right_n + 1;
    else misses := misses || to_jsonb(qid); end if;
    i := i + 1;
  end loop;
  score := round(100.0 * right_n / greatest(total, 1))::int;
  if k->>'kind' = 'unit' then
    update public.cw_work set test_key = null, last_try = last_try || jsonb_build_object('U', now()), unit_best = greatest(unit_best, score), unit_tries = unit_tries + 1, updated_at = now()
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
    best := r.unit_best; reveal := best >= public._cw_rule('unit_pass') or r.unit_tries >= 3;
  else
    cur := coalesce(r.ch_test->(k->>'ch'), '{}');
    best := greatest(coalesce((cur->>'best')::int, 0), score);
    reveal := best >= 80 or coalesce((cur->>'tries')::int, 0) + 1 >= 3;
    update public.cw_work set test_key = null, updated_at = now(), last_try = last_try || jsonb_build_object('T' || (k->>'ch'), now()),
           ch_test = ch_test || jsonb_build_object(k->>'ch', jsonb_build_object('best', best, 'tries', coalesce((cur->>'tries')::int, 0) + 1))
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  end if;
  return jsonb_build_object('kind', k->>'kind', 'chapter', k->'ch', 'score', score, 'right', right_n, 'total', total, 'best', best,
                            'passed', k->>'kind' <> 'unit' or best >= public._cw_rule('unit_pass'),
                            'misses', misses, 'reveal', reveal, 'no_answer', (select coalesce(jsonb_agg(id), '[]') from public.cw_bank where kind = 'reason' and id in (select jsonb_array_elements_text(misses))), 'work', public._cw_view(r));
end $$;

create or replace function public.cw_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; avg_s int; avg_l int; fin int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then return jsonb_build_object('ok', true, 'already', true, 'work', public._cw_view(r)); end if;
  if not public._cw_all_learned(p_unit, r.learn_best) then raise exception 'Pass Learn (80%%) in every chapter first'; end if;
  avg_s := public._cw_avg2(p_unit, r.ch_stories);
  if avg_s is null then raise exception 'Finish all the stories in every chapter first'; end if;
  avg_l := public._cw_learn_avg(p_unit, r.learn_grade);
  fin := round((avg_l + avg_s) / 2.0)::int;
  if fin < public._cw_rule('min_final') then
    raise exception '%', format('Your score is %s%%. You need at least 70%% to turn this in. Retake Learn or improve a story.', fin);
  end if;
  update public.cw_work set status = 'submitted', submitted_at = now(), story_avg = avg_s, learn_avg = avg_l, final_score = fin, updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  perform public._cw_marker(p_student_id, p_trimester, p_unit, true);
  return jsonb_build_object('ok', true, 'work', public._cw_view(r));
end $$;

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
            'posted_score', w.posted_score, 'posted_at', w.posted_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
            from public.students s
            left join public.cw_work w on w.student_id = s.id and w.trimester = p_trimester and w.unit = p_unit
           where s.trimester = p_trimester and s.class_code not ilike 'VISITOR%'));
end $$;
