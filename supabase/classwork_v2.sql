-- ============================================================
-- Unit Classwork v2 (2026-11-12). Run AFTER supabase/classwork.sql. Safe to re-run.
-- Each unit is split into chapters. Per chapter:
--   Learn (graded here): every chapter word + a dropdown of definitions (the chapter's own plus
--     some from nearby chapters). 80% passes; best score kept; unlimited retakes. Passing opens the next chapter.
--   Practice: flashcards + matching (page only, no points).
--   Chapter Test (graded here): 20 questions, about 8 reasoning + 12 recall. Best kept. No pass mark.
--   3 stories (2 words from that chapter each, 25+ words, 1 "no story" swap per chapter).
-- After every chapter's Learn is passed and all stories are written:
--   Unit Test (graded here, its own grade): 20 questions across the unit, 80% to pass, best kept.
--   Turn In: Classwork score = (average best Learn % + average story score) / 2, 70% minimum.
-- Adds columns/tables and replaces the cw_* functions. Nothing is deleted.
-- ============================================================

create table if not exists public.cw_bank (
  id       text primary key,      -- hash of the question text (classwork_bank.js uses the same id)
  chapter  int  not null,
  kind     text not null check (kind in ('recall', 'reason')),
  h        text not null          -- first 12 hex of md5(lower(trim(correct answer)))
);
alter table public.cw_bank enable row level security;
create index if not exists cw_bank_ch on public.cw_bank (chapter, kind);

alter table public.cw_work add column if not exists learn_best  jsonb not null default '{}'::jsonb;  -- chapter -> best %
alter table public.cw_work add column if not exists learn_tries jsonb not null default '{}'::jsonb;  -- chapter -> tries
alter table public.cw_work add column if not exists learn_key   jsonb;                               -- open Learn: {ch, words:[n], defs:[[unit,n]]}
alter table public.cw_work add column if not exists ch_test     jsonb not null default '{}'::jsonb;  -- chapter -> {best, tries}
alter table public.cw_work add column if not exists test_key    jsonb;                               -- open test: {kind:'ch'|'unit', ch, ids:[]}
alter table public.cw_work add column if not exists ch_stories  jsonb not null default '{}'::jsonb;  -- chapter -> [s0,s1,s2]
alter table public.cw_work add column if not exists unit_best   int not null default 0;
alter table public.cw_work add column if not exists unit_tries  int not null default 0;
alter table public.cw_work add column if not exists learn_avg   int;

create or replace function public._cw_rule(k text) returns int language sql immutable as $$
  select case k when 'quiz_n' then 20 when 'unlock' then 80 when 'min_final' then 70
                when 'min_words' then 25 when 'stories' then 3 when 'swaps' then 1
                when 'min_seconds' then 45 when 'learn_pass' then 80 when 'unit_pass' then 80
                when 'reason_n' then 8 when 'extra_defs' then 6 end;
$$;

create or replace function public._cw_chapters(p_unit int) returns int[] language sql stable as $$
  select array_agg(distinct chapter order by chapter) from public.cw_terms where unit = p_unit;
$$;

-- story average across every chapter (null until every chapter has 3 saved stories)
create or replace function public._cw_avg2(p_unit int, p_ch jsonb) returns int language sql stable as $$
  select case when (select bool_and(coalesce((select count(*) from jsonb_array_elements(coalesce(p_ch->(c::text), '[]')) e
                                              where jsonb_typeof(e) = 'object'), 0) = 3)
                      from unnest(public._cw_chapters(p_unit)) c)
              then round((select avg((e->'score'->>'total')::numeric)
                            from unnest(public._cw_chapters(p_unit)) c, jsonb_array_elements(p_ch->(c::text)) e))::int end;
$$;

create or replace function public._cw_learn_avg(p_unit int, p_lb jsonb) returns int language sql stable as $$
  select round(avg(coalesce((p_lb->>(c::text))::numeric, 0)))::int from unnest(public._cw_chapters(p_unit)) c;
$$;

create or replace function public._cw_learn_ok(p_unit int, p_lb jsonb, p_ch int) returns boolean language sql stable as $$
  select coalesce((p_lb->>(p_ch::text))::int, 0) >= public._cw_rule('learn_pass');
$$;

create or replace function public._cw_all_learned(p_unit int, p_lb jsonb) returns boolean language sql stable as $$
  select bool_and(public._cw_learn_ok(p_unit, p_lb, c)) from unnest(public._cw_chapters(p_unit)) c;
$$;

-- a chapter is open when every earlier chapter in the unit has Learn passed
create or replace function public._cw_ch_open(p_unit int, p_lb jsonb, p_ch int) returns boolean language sql stable as $$
  select p_ch = any(public._cw_chapters(p_unit))
     and coalesce(bool_and(public._cw_learn_ok(p_unit, p_lb, c)), true)
    from unnest(public._cw_chapters(p_unit)) c where c < p_ch;
$$;

create or replace function public._cw_view(r public.cw_work) returns jsonb language sql stable as $$
  select jsonb_build_object('unit', r.unit, 'status', r.status, 'submitted_at', r.submitted_at, 'returned_at', r.returned_at,
    'learn_best', r.learn_best, 'learn_tries', r.learn_tries, 'ch_test', r.ch_test, 'ch_stories', r.ch_stories,
    'swapped', r.swapped, 'story_open', r.story_open, 'unit_best', r.unit_best, 'unit_tries', r.unit_tries,
    'learn_avg', public._cw_learn_avg(r.unit, r.learn_best), 'story_avg', public._cw_avg2(r.unit, r.ch_stories),
    'final_score', case when r.status = 'submitted' then r.final_score
                        when public._cw_avg2(r.unit, r.ch_stories) is not null
                        then round((public._cw_learn_avg(r.unit, r.learn_best) + public._cw_avg2(r.unit, r.ch_stories)) / 2.0)::int end,
    'chapters', to_jsonb(public._cw_chapters(r.unit)),
    'learn_open', r.learn_key ->> 'ch', 'test_open', r.test_key ->> 'kind');
$$;

-- ---------- Learn ----------
-- Returns the chapter's words and one shared list of definitions (the chapter's own + a few from nearby chapters).
create or replace function public.cw_learn_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; words int[]; defs jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not public._cw_ch_open(p_unit, r.learn_best, p_ch) then raise exception 'Finish Learn in the earlier chapter first'; end if;
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

-- p_answers: for each word (in order), the index of the definition picked (or -1)
create or replace function public.cw_learn_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; k jsonb; ch int; i int := 0; w int; pick int; right_n int := 0; total int; score int; misses jsonb := '[]'; d jsonb; best int;
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
  update public.cw_work set learn_key = null,
         learn_best = learn_best || jsonb_build_object(ch::text, best),
         learn_tries = learn_tries || jsonb_build_object(ch::text, coalesce((learn_tries->>(ch::text))::int, 0) + 1),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('chapter', ch, 'score', score, 'right', right_n, 'total', total, 'best', best,
                            'passed', best >= public._cw_rule('learn_pass'), 'misses', misses, 'work', public._cw_view(r));
end $$;

-- ---------- Chapter Test / Unit Test ----------
-- p_ch = chapter number for a Chapter Test, or null for the Unit Test. Returns question ids (the page has the text).
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

-- p_answers: the answer TEXT picked for each question, in order (null if blank)
create or replace function public.cw_test_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; k jsonb; i int := 0; qid text; right_n int := 0; total int; score int; misses jsonb := '[]'; ans text; best int; cur jsonb;
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
    update public.cw_work set test_key = null, unit_best = greatest(unit_best, score), unit_tries = unit_tries + 1, updated_at = now()
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
    best := r.unit_best;
  else
    cur := coalesce(r.ch_test->(k->>'ch'), '{}');
    best := greatest(coalesce((cur->>'best')::int, 0), score);
    update public.cw_work set test_key = null, updated_at = now(),
           ch_test = ch_test || jsonb_build_object(k->>'ch', jsonb_build_object('best', best, 'tries', coalesce((cur->>'tries')::int, 0) + 1))
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  end if;
  return jsonb_build_object('kind', k->>'kind', 'chapter', k->'ch', 'score', score, 'right', right_n, 'total', total, 'best', best,
                            'passed', k->>'kind' <> 'unit' or best >= public._cw_rule('unit_pass'),
                            'misses', misses, 'work', public._cw_view(r));
end $$;

-- ---------- stories (per chapter) ----------
create or replace function public.cw_story_open2(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int, p_slot int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; k text := p_ch || ':' || p_slot;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  if p_slot not between 0 and 2 then raise exception 'bad story'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if not (r.story_open ? k) then
    update public.cw_work set story_open = story_open || jsonb_build_object(k, now())
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cw_story_save2(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int,
                                                 p_slot int, p_a int, p_b int, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; ta public.cw_terms; tb public.cw_terms; sc jsonb; opened timestamptz; i int; arr jsonb;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  if p_slot not between 0 and 2 then raise exception 'bad story'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted. Ask Mr. Dopp to return it if you need to change something.'; end if;
  if not public._cw_ch_open(p_unit, r.learn_best, p_ch) or not public._cw_learn_ok(p_unit, r.learn_best, p_ch) then
    raise exception 'Pass Learn (80%%) for this chapter first'; end if;
  if p_a = p_b then raise exception 'Pick two different words'; end if;
  select * into ta from public.cw_terms where unit = p_unit and n = p_a and chapter = p_ch;
  select * into tb from public.cw_terms where unit = p_unit and n = p_b and chapter = p_ch;
  if ta.term is null or tb.term is null then raise exception 'Pick two words from this chapter'; end if;
  if not ta.story_ok or not tb.story_ok then raise exception 'That word can''t be used for a story'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int in (p_a, p_b)) then
    raise exception 'You already swapped out that word'; end if;
  arr := coalesce(r.ch_stories->(p_ch::text), '[null,null,null]'::jsonb);
  for i in 0 .. 2 loop
    if i <> p_slot and jsonb_typeof(arr->i) = 'object'
       and ((arr->i->>'a')::int in (p_a, p_b) or (arr->i->>'b')::int in (p_a, p_b)) then
      raise exception 'Each story needs 2 new words (you used one already)';
    end if;
  end loop;
  if length(coalesce(p_text, '')) > 3000 then raise exception 'That story is too long'; end if;
  opened := (r.story_open->>(p_ch || ':' || p_slot))::timestamptz;
  if opened is null or now() - opened < make_interval(secs => public._cw_rule('min_seconds')) then
    raise exception 'Take a little more time on your story before saving it';
  end if;
  sc := public._cw_story_score(p_text, ta.term, tb.term);
  arr := jsonb_set(arr, array[p_slot::text], jsonb_build_object('a', p_a, 'b', p_b, 'text', btrim(p_text), 'score', sc, 'saved_at', now()));
  update public.cw_work set ch_stories = ch_stories || jsonb_build_object(p_ch::text, arr), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'score', sc, 'work', public._cw_view(r));
end $$;

-- 1 "no story for this word" swap per chapter
create or replace function public.cw_swap2(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_ch int, p_n int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; arr jsonb; i int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not exists (select 1 from public.cw_terms where unit = p_unit and n = p_n and chapter = p_ch) then raise exception 'No such word'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int = p_n) then return jsonb_build_object('ok', true, 'work', public._cw_view(r)); end if;
  if (select count(*) from jsonb_array_elements(r.swapped) s where (s->>'ch')::int = p_ch) >= public._cw_rule('swaps') then
    raise exception 'You''ve used the word swap for this chapter'; end if;
  if (select count(*) from regexp_split_to_table(btrim(coalesce(p_reason, '')), '\s+') x where x ~ '[A-Za-z]') < 5 then
    raise exception 'Write at least 5 words about why you don''t have a story for this word';
  end if;
  arr := coalesce(r.ch_stories->(p_ch::text), '[]'::jsonb);
  for i in 0 .. 2 loop
    if jsonb_typeof(arr->i) = 'object' and ((arr->i->>'a')::int = p_n or (arr->i->>'b')::int = p_n) then
      raise exception 'That word is already in one of your stories';
    end if;
  end loop;
  update public.cw_work set swapped = swapped || jsonb_build_array(jsonb_build_object('n', p_n, 'ch', p_ch, 'reason', left(btrim(p_reason), 500), 'at', now())),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'work', public._cw_view(r));
end $$;

-- ---------- turn in ----------
create or replace function public.cw_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; avg_s int; avg_l int; fin int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then return jsonb_build_object('ok', true, 'already', true, 'work', public._cw_view(r)); end if;
  if not public._cw_all_learned(p_unit, r.learn_best) then raise exception 'Pass Learn (80%%) in every chapter first'; end if;
  avg_s := public._cw_avg2(p_unit, r.ch_stories);
  if avg_s is null then raise exception 'Finish all 3 stories in every chapter first'; end if;
  avg_l := public._cw_learn_avg(p_unit, r.learn_best);
  fin := round((avg_l + avg_s) / 2.0)::int;
  if fin < public._cw_rule('min_final') then
    raise exception '%', format('Your score is %s%%. You need at least 70%% to turn this in. Retake Learn or improve a story.', fin);
  end if;
  update public.cw_work set status = 'submitted', submitted_at = now(), story_avg = avg_s, learn_avg = avg_l, final_score = fin, updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  perform public._cw_marker(p_student_id, p_trimester, p_unit, true);
  return jsonb_build_object('ok', true, 'work', public._cw_view(r));
end $$;

-- ---------- teacher ----------
create or replace function public.cw_teacher_list(p_teacher_pass text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return jsonb_build_object('live', (select live from public.cw_live where id = 1),
    'chapters', to_jsonb(public._cw_chapters(p_unit)),
    'terms', (select jsonb_agg(jsonb_build_object('n', n, 'term', term) order by n) from public.cw_terms where unit = p_unit),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'first', s.display_name, 'last', s.last_name, 'code', s.class_code,
            'status', coalesce(w.status, 'not_started'), 'learn_best', w.learn_best, 'learn_avg', public._cw_learn_avg(p_unit, coalesce(w.learn_best, '{}')),
            'ch_test', w.ch_test, 'ch_stories', w.ch_stories, 'swapped', w.swapped,
            'story_avg', public._cw_avg2(p_unit, coalesce(w.ch_stories, '{}')), 'unit_best', w.unit_best, 'unit_tries', w.unit_tries,
            'final_score', w.final_score, 'submitted_at', w.submitted_at, 'updated_at', w.updated_at,
            'posted_score', w.posted_score, 'posted_at', w.posted_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
            from public.students s
            left join public.cw_work w on w.student_id = s.id and w.trimester = p_trimester and w.unit = p_unit
           where s.trimester = p_trimester and s.class_code not ilike 'VISITOR%'));
end $$;

revoke all on function public.cw_learn_start(uuid, text, text, int, int) from public;
revoke all on function public.cw_learn_submit(uuid, text, text, int, jsonb) from public;
revoke all on function public.cw_test_start(uuid, text, text, int, int) from public;
revoke all on function public.cw_test_submit(uuid, text, text, int, jsonb) from public;
revoke all on function public.cw_story_open2(uuid, text, text, int, int, int) from public;
revoke all on function public.cw_story_save2(uuid, text, text, int, int, int, int, int, text) from public;
revoke all on function public.cw_swap2(uuid, text, text, int, int, int, text) from public;
grant execute on function public.cw_learn_start(uuid, text, text, int, int) to anon, authenticated;
grant execute on function public.cw_learn_submit(uuid, text, text, int, jsonb) to anon, authenticated;
grant execute on function public.cw_test_start(uuid, text, text, int, int) to anon, authenticated;
grant execute on function public.cw_test_submit(uuid, text, text, int, jsonb) to anon, authenticated;
grant execute on function public.cw_story_open2(uuid, text, text, int, int, int) to anon, authenticated;
grant execute on function public.cw_story_save2(uuid, text, text, int, int, int, int, int, text) to anon, authenticated;
grant execute on function public.cw_swap2(uuid, text, text, int, int, int, text) to anon, authenticated;
