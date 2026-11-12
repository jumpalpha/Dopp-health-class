-- ============================================================
-- Unit Classwork (classwork.html). Safe to re-run.
-- Replaces the Schoology "Unit # Classwork" spreadsheets with a doppsclass.com page:
--   1. Vocabulary practice (flashcards + matching, no points, done in the page)
--   2. Mastery check: 20 random words from the unit, graded HERE, best score kept, unlimited retakes
--   3. My Stories (opens at 80% mastery): 3 true / real-life stories, 2 different words each,
--      25+ words each, scored HERE by a fixed rubric (length 40, both words 30, detail 30)
--   4. Submit: final = round((best mastery + story average) / 2); under 70 can't be submitted
--
-- Adds new tables + functions only. Nothing existing is altered or deleted.
-- Same pattern as the rest of the site: RLS on, no policies, the page only calls the
-- SECURITY DEFINER functions below (students: id + PIN hash, teacher: dashboard passphrase).
--
-- HIDDEN UNTIL TURNED ON: while cw_live.live = false, only class code TEST (Mr. Dopp's test
-- account and Pilot) can use it. Turn it on from the Teacher Dashboard → Unit Classwork.
--
-- Paste into Supabase > SQL Editor > New query > Run, THEN run supabase/classwork_terms.sql.
-- Expected result for each: "Success. No rows returned".
-- ============================================================

create table if not exists public.cw_terms (
  unit      int  not null,
  chapter   int  not null,
  n         int  not null,          -- position in the unit's list
  term      text not null,
  def       text not null,
  extra     boolean not null default false,   -- one of the extra Schoology words
  story_ok  boolean not null default true,    -- false = in vocab + mastery, but not for stories
  primary key (unit, n)
);
alter table public.cw_terms enable row level security;

create table if not exists public.cw_live (
  id    int primary key default 1 check (id = 1),
  live  boolean not null default false,
  changed_at timestamptz not null default now()
);
alter table public.cw_live enable row level security;
insert into public.cw_live (id, live) values (1, false) on conflict (id) do nothing;

create table if not exists public.cw_work (
  student_id     uuid not null references public.students(id) on delete cascade,
  trimester      text not null,
  unit           int  not null check (unit between 1 and 9),
  mastery_best   int  not null default 0,
  mastery_tries  int  not null default 0,
  quiz           jsonb,               -- the open mastery check's answer key (never sent to the page)
  quiz_started_at timestamptz,
  stories        jsonb not null default '[null,null,null]'::jsonb,  -- 3 slots
  story_open     jsonb not null default '{}'::jsonb,                -- slot -> first time the writing box opened
  swapped        jsonb not null default '[]'::jsonb,                -- [{n, reason, at}]  ("no story for this word")
  status         text not null default 'draft' check (status in ('draft', 'submitted')),
  story_avg      int,
  final_score    int,
  submitted_at   timestamptz,
  returned_at    timestamptz,
  posted_score   int,                 -- what the grading run last posted to Schoology
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (student_id, trimester, unit)
);
alter table public.cw_work enable row level security;

-- ---------- rules (the page uses the same numbers) ----------
create or replace function public._cw_rule(k text) returns int language sql immutable as $$
  select case k when 'quiz_n' then 20 when 'unlock' then 80 when 'min_final' then 70
                when 'min_words' then 25 when 'stories' then 3 when 'swaps' then 2
                when 'min_seconds' then 45 end;
$$;

-- ---------- access ----------
create or replace function public._cw_ok(p_student_id uuid, p_pin_hash text, p_trimester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                 where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester
                   and ((select live from public.cw_live where id = 1) or s.class_code ilike 'TEST'));
$$;

-- ---------- story scoring (classwork.html has the same rules in JS for live feedback) ----------
-- regex for one term: case-insensitive, "-" and " " interchangeable, simple endings on the last word,
-- "a/b c" also accepts "a c" and "b c", "(XYZ)" also accepts XYZ by itself.
create or replace function public._cw_term_rx(p_term text) returns text
language plpgsql immutable as $$
declare base text; abbr text; alts text[] := '{}'; v text; parts text[]; i int; rx text := ''; one text;
begin
  abbr := substring(p_term from '\(([^)]+)\)');
  base := btrim(regexp_replace(p_term, '\s*\([^)]*\)', '', 'g'));
  alts := array_append(alts, base);
  if base ~ '/' then
    parts := regexp_split_to_array(split_part(base, ' ', 1), '/');
    for i in 1 .. coalesce(array_length(parts, 1), 0) loop
      alts := array_append(alts, btrim(parts[i] || ' ' || substring(base from position(' ' in base) + 1)));
    end loop;
    if position(' ' in base) = 0 then alts := parts; end if;
  end if;
  if abbr is not null then alts := array_append(alts, regexp_replace(abbr, 's$', '')); end if;
  foreach v in array alts loop
    v := lower(btrim(v));
    if v = '' then continue; end if;
    one := regexp_replace(v, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
    one := regexp_replace(one, '[- ]+', '[- ]?', 'g');
    -- endings: s, es, ed, d, ing, ies, ly, also drop a final e or y
    if one ~ '[a-z]$' then
      one := '(' || one || '|' || regexp_replace(one, '[ey]$', '') || '|' || regexp_replace(one, '(e?s)$', '') || ')(s|es|e|ed|d|ing|ies|ly|ness)?';
    end if;
    rx := rx || case when rx = '' then '' else '|' end || one;
  end loop;
  return '(^|[^a-z0-9])(' || rx || ')($|[^a-z0-9])';
end $$;

create or replace function public._cw_cue(p_text text) returns boolean
language sql immutable as $$
  select lower(coalesce(p_text, '')) ~ (
    '\m(my|our) (mom|dad|mother|father|parents?|brothers?|sisters?|siblings?|friends?|best friend|grandma|grandpa|grandmother|grandfather|grandparents?|coach|teacher|cousins?|aunt|uncle|family|team|teammates?|boss|neighbors?|dog|cat|girlfriend|boyfriend|stepmom|stepdad)\M'
    || '|\m(at|in|on) (the|my|our|a) [a-z]+'
    || '|\m(home|school|practice|church|work|park|store|gym|field|class|game|camp|vacation|hospital|doctor)\M'
    || '|\m(yesterday|today|tonight|ago|once|weekend|morning|afternoon|evening|night|summer|winter|spring|fall|birthday|christmas|thanksgiving|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\M'
    || '|\mlast (week|year|month|night|time)\M|\mwhen i was\M|\myears? old\M|\m[0-9]{1,2}(st|nd|rd|th)? grade\M|\m(19|20)[0-9]{2}\M');
$$;

create or replace function public._cw_story_score(p_text text, p_a text, p_b text) returns jsonb
language plpgsql immutable as $$
declare t text := coalesce(p_text, ''); w int; s int; ha boolean; hb boolean; cue boolean; len int; words int; detail int;
begin
  w := (select count(*) from regexp_split_to_table(btrim(t), '\s+') x where x ~ '[A-Za-z]');
  s := (select count(*) from regexp_split_to_table(t, '[.!?]+') seg
         where (select count(*) from regexp_split_to_table(btrim(seg), '\s+') x where x ~ '[A-Za-z]') >= 3);
  ha := lower(t) ~ public._cw_term_rx(p_a);
  hb := lower(t) ~ public._cw_term_rx(p_b);
  cue := public._cw_cue(t);
  len := least(40, floor(40.0 * w / public._cw_rule('min_words'))::int);
  words := (case when ha then 15 else 0 end) + (case when hb then 15 else 0 end);
  detail := (case when s >= 2 then 15 else 0 end) + (case when cue then 15 else 0 end);
  return jsonb_build_object('words', w, 'sentences', s, 'has_a', ha, 'has_b', hb, 'cue', cue,
                            'length', len, 'used', words, 'detail', detail, 'total', len + words + detail);
end $$;

-- ---------- helpers ----------
create or replace function public._cw_row(p_student uuid, p_tri text, p_unit int) returns public.cw_work
language plpgsql security definer set search_path = public as $$
declare r public.cw_work;
begin
  if not exists (select 1 from public.cw_terms where unit = p_unit) then raise exception 'No such unit'; end if;
  insert into public.cw_work (student_id, trimester, unit) values (p_student, p_tri, p_unit) on conflict do nothing;
  select * into r from public.cw_work where student_id = p_student and trimester = p_tri and unit = p_unit for update;
  return r;
end $$;

create or replace function public._cw_avg(p_stories jsonb) returns int language sql immutable as $$
  select case when (select count(*) from jsonb_array_elements(p_stories) e where jsonb_typeof(e) = 'object') = 3
              then round((select avg((e->'score'->>'total')::numeric) from jsonb_array_elements(p_stories) e))::int end;
$$;

create or replace function public._cw_view(r public.cw_work) returns jsonb language sql stable as $$
  select jsonb_build_object('unit', r.unit, 'mastery_best', r.mastery_best, 'mastery_tries', r.mastery_tries,
    'stories', r.stories, 'swapped', r.swapped, 'story_open', r.story_open, 'status', r.status,
    'story_avg', public._cw_avg(r.stories),
    'final_score', case when public._cw_avg(r.stories) is not null then round((r.mastery_best + public._cw_avg(r.stories)) / 2.0)::int end,
    'submitted_at', r.submitted_at, 'returned_at', r.returned_at, 'quiz_open', r.quiz is not null);
$$;

create or replace function public._cw_marker(p_student uuid, p_tri text, p_unit int, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  begin
    if p_done then
      insert into public.student_project_data (student_id, trimester, project_key, data, updated_at)
      values (p_student, p_tri, 'cw_unit' || p_unit || '_done', jsonb_build_object('status', 'submitted'), now())
      on conflict (student_id, trimester, project_key) do update set data = excluded.data, updated_at = now();
    else
      delete from public.student_project_data where student_id = p_student and trimester = p_tri and project_key = 'cw_unit' || p_unit || '_done';
    end if;
  exception when others then null;   -- the checklist marker must never block the work
  end;
end $$;

revoke all on function public._cw_ok(uuid, text, text) from public, anon, authenticated;
revoke all on function public._cw_row(uuid, text, int) from public, anon, authenticated;
revoke all on function public._cw_marker(uuid, text, int, boolean) from public, anon, authenticated;

-- ---------- student ----------
-- Is Classwork open for me, and where am I in each unit?
create or replace function public.cw_status(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._arcade_auth(p_student_id, p_pin_hash, p_trimester) then raise exception 'not signed in'; end if;
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then return jsonb_build_object('open', false); end if;
  return jsonb_build_object('open', true, 'live', (select live from public.cw_live where id = 1),
    'units', coalesce((select jsonb_agg(public._cw_view(w) order by w.unit) from public.cw_work w
                        where w.student_id = p_student_id and w.trimester = p_trimester), '[]'::jsonb));
end $$;

create or replace function public.cw_get(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  return public._cw_view(r);
end $$;

-- Start a mastery check: 20 random words. Each question shows a definition and 4 words to pick from.
create or replace function public.cw_quiz_start(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; t record; key jsonb := '[]'; qs jsonb := '[]'; opts int[]; o int; i int; tmp int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  for t in select * from public.cw_terms where unit = p_unit order by random() limit public._cw_rule('quiz_n') loop
    -- 3 wrong answers from the same unit, then shuffle
    opts := array[t.n] || array(select n from public.cw_terms where unit = p_unit and n <> t.n
                                 and lower(term) <> lower(t.term) order by random() limit 3);
    for i in reverse array_length(opts, 1) .. 2 loop
      o := 1 + floor(random() * i)::int; tmp := opts[i]; opts[i] := opts[o]; opts[o] := tmp;
    end loop;
    key := key || jsonb_build_array(jsonb_build_object('n', t.n, 'opts', to_jsonb(opts)));
    qs := qs || jsonb_build_array(jsonb_build_object('def', t.def,
            'opts', (select jsonb_agg(c.term order by array_position(opts, c.n)) from public.cw_terms c where c.unit = p_unit and c.n = any(opts))));
  end loop;
  update public.cw_work set quiz = key, quiz_started_at = now(), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit;
  return jsonb_build_object('questions', qs);
end $$;

-- p_answers: the index (0-3) picked for each question, in order. Unanswered = null/-1.
create or replace function public.cw_quiz_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; q jsonb; i int := 0; right_n int := 0; score int; misses jsonb := '[]'; pick int; correct_ix int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.quiz is null then raise exception 'Start a new mastery check first'; end if;
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  for q in select * from jsonb_array_elements(r.quiz) loop
    pick := case when jsonb_typeof(p_answers->i) = 'number' then (p_answers->>i)::int else -1 end;
    correct_ix := (select k - 1 from jsonb_array_elements(q->'opts') with ordinality e(v, k) where (e.v)::int = (q->>'n')::int);
    if pick = correct_ix then right_n := right_n + 1;
    else misses := misses || jsonb_build_array(jsonb_build_object('q', i, 'answer', correct_ix,
                     'term', (select term from public.cw_terms where unit = p_unit and n = (q->>'n')::int)));
    end if;
    i := i + 1;
  end loop;
  score := round(100.0 * right_n / greatest(jsonb_array_length(r.quiz), 1))::int;
  update public.cw_work set quiz = null, quiz_started_at = null, mastery_tries = mastery_tries + 1,
         mastery_best = greatest(mastery_best, score), updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('score', score, 'right', right_n, 'total', jsonb_array_length(misses) + right_n,
                            'best', r.mastery_best, 'misses', misses);
end $$;

-- The writing box for a story slot was opened (starts the minimum writing time).
create or replace function public.cw_story_open(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_slot int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  if p_slot not between 0 and 2 then raise exception 'bad story'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if not (r.story_open ? p_slot::text) then
    update public.cw_work set story_open = story_open || jsonb_build_object(p_slot::text, now())
     where student_id = p_student_id and trimester = p_trimester and unit = p_unit;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cw_story_save(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int,
                                                p_slot int, p_a int, p_b int, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; ta public.cw_terms; tb public.cw_terms; sc jsonb; opened timestamptz; i int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  if p_slot not between 0 and 2 then raise exception 'bad story'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted. Ask Mr. Dopp to return it if you need to change something.'; end if;
  if r.mastery_best < public._cw_rule('unlock') then raise exception 'Pass the mastery check (80%%) first'; end if;
  if p_a = p_b then raise exception 'Pick two different words'; end if;
  select * into ta from public.cw_terms where unit = p_unit and n = p_a;
  select * into tb from public.cw_terms where unit = p_unit and n = p_b;
  if ta.term is null or tb.term is null then raise exception 'Pick two words from this unit'; end if;
  if not ta.story_ok or not tb.story_ok then raise exception 'That word can''t be used for a story'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int in (p_a, p_b)) then
    raise exception 'You already swapped out that word'; end if;
  for i in 0 .. 2 loop
    if i <> p_slot and jsonb_typeof(r.stories->i) = 'object'
       and ((r.stories->i->>'a')::int in (p_a, p_b) or (r.stories->i->>'b')::int in (p_a, p_b)) then
      raise exception 'Each story needs 2 new words (you used one already)';
    end if;
  end loop;
  if length(coalesce(p_text, '')) > 3000 then raise exception 'That story is too long'; end if;
  opened := (r.story_open->>p_slot::text)::timestamptz;
  if opened is null or now() - opened < make_interval(secs => public._cw_rule('min_seconds')) then
    raise exception 'Take a little more time on your story before saving it';
  end if;
  sc := public._cw_story_score(p_text, ta.term, tb.term);
  update public.cw_work
     set stories = jsonb_set(stories, array[p_slot::text], jsonb_build_object('a', p_a, 'b', p_b,
                     'text', btrim(p_text), 'score', sc, 'saved_at', now())),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'score', sc, 'work', public._cw_view(r));
end $$;

-- "I don't have a story for this word": a short reason, then the word is off the table. 2 per unit.
create or replace function public.cw_swap(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int, p_n int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; i int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not exists (select 1 from public.cw_terms where unit = p_unit and n = p_n) then raise exception 'No such word'; end if;
  if jsonb_array_length(r.swapped) >= public._cw_rule('swaps') then raise exception 'You''ve used both word swaps for this unit'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s->>'n')::int = p_n) then return jsonb_build_object('ok', true); end if;
  if (select count(*) from regexp_split_to_table(btrim(coalesce(p_reason, '')), '\s+') x where x ~ '[A-Za-z]') < 5 then
    raise exception 'Write at least 5 words about why you don''t have a story for this word';
  end if;
  for i in 0 .. 2 loop
    if jsonb_typeof(r.stories->i) = 'object' and ((r.stories->i->>'a')::int = p_n or (r.stories->i->>'b')::int = p_n) then
      raise exception 'That word is already in one of your stories';
    end if;
  end loop;
  update public.cw_work set swapped = swapped || jsonb_build_array(jsonb_build_object('n', p_n, 'reason', left(btrim(p_reason), 500), 'at', now())),
         updated_at = now()
   where student_id = p_student_id and trimester = p_trimester and unit = p_unit returning * into r;
  return jsonb_build_object('ok', true, 'work', public._cw_view(r));
end $$;

create or replace function public.cw_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.cw_work; avg_s int; fin int;
begin
  if not public._cw_ok(p_student_id, p_pin_hash, p_trimester) then raise exception 'Classwork is not open yet'; end if;
  r := public._cw_row(p_student_id, p_trimester, p_unit);
  if r.status = 'submitted' then return jsonb_build_object('ok', true, 'already', true, 'work', public._cw_view(r)); end if;
  if r.mastery_best < public._cw_rule('unlock') then raise exception 'Pass the mastery check (80%%) first'; end if;
  avg_s := public._cw_avg(r.stories);
  if avg_s is null then raise exception 'Finish all 3 stories first'; end if;
  fin := round((r.mastery_best + avg_s) / 2.0)::int;
  if fin < public._cw_rule('min_final') then
    raise exception '%', format('Your score is %s%%. You need at least 70%% to turn this in. Improve a story or retake the mastery check.', fin);
  end if;
  update public.cw_work set status = 'submitted', submitted_at = now(), story_avg = avg_s, final_score = fin, updated_at = now()
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
    'terms', (select jsonb_agg(jsonb_build_object('n', n, 'term', term) order by n) from public.cw_terms where unit = p_unit),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'first', s.display_name, 'last', s.last_name, 'code', s.class_code,
            'status', coalesce(w.status, 'not_started'), 'mastery_best', w.mastery_best, 'mastery_tries', w.mastery_tries,
            'stories', w.stories, 'swapped', w.swapped, 'story_avg', public._cw_avg(w.stories),
            'final_score', w.final_score, 'submitted_at', w.submitted_at, 'updated_at', w.updated_at,
            'posted_score', w.posted_score, 'posted_at', w.posted_at)
          order by s.class_code, s.last_name, s.display_name), '[]'::jsonb)
            from public.students s
            left join public.cw_work w on w.student_id = s.id and w.trimester = p_trimester and w.unit = p_unit
           where s.trimester = p_trimester and s.class_code not ilike 'VISITOR%'));
end $$;

create or replace function public.cw_teacher_return(p_teacher_pass text, p_trimester text, p_student uuid, p_unit int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.cw_work set status = 'draft', submitted_at = null, final_score = null, returned_at = now(), updated_at = now()
   where student_id = p_student and trimester = p_trimester and unit = p_unit and status = 'submitted';
  if not found then raise exception 'Nothing submitted to return'; end if;
  perform public._cw_marker(p_student, p_trimester, p_unit, false);
  return jsonb_build_object('ok', true);
end $$;

-- the grading run records what it posted to Schoology
create or replace function public.cw_teacher_posted(p_teacher_pass text, p_trimester text, p_student uuid, p_unit int, p_score int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.cw_work set posted_score = p_score, posted_at = now()
   where student_id = p_student and trimester = p_trimester and unit = p_unit;
  return jsonb_build_object('ok', found);
end $$;

-- turn Unit Classwork on for everyone (true) or back to TEST-only (false)
create or replace function public.cw_teacher_live(p_teacher_pass text, p_live boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  update public.cw_live set live = coalesce(p_live, false), changed_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'live', coalesce(p_live, false));
end $$;

revoke all on function public.cw_status(uuid, text, text) from public;
revoke all on function public.cw_get(uuid, text, text, int) from public;
revoke all on function public.cw_quiz_start(uuid, text, text, int) from public;
revoke all on function public.cw_quiz_submit(uuid, text, text, int, jsonb) from public;
revoke all on function public.cw_story_open(uuid, text, text, int, int) from public;
revoke all on function public.cw_story_save(uuid, text, text, int, int, int, int, text) from public;
revoke all on function public.cw_swap(uuid, text, text, int, int, text) from public;
revoke all on function public.cw_submit(uuid, text, text, int) from public;
revoke all on function public.cw_teacher_list(text, text, int) from public;
revoke all on function public.cw_teacher_return(text, text, uuid, int) from public;
revoke all on function public.cw_teacher_posted(text, text, uuid, int, int) from public;
revoke all on function public.cw_teacher_live(text, boolean) from public;
grant execute on function public.cw_status(uuid, text, text) to anon, authenticated;
grant execute on function public.cw_get(uuid, text, text, int) to anon, authenticated;
grant execute on function public.cw_quiz_start(uuid, text, text, int) to anon, authenticated;
grant execute on function public.cw_quiz_submit(uuid, text, text, int, jsonb) to anon, authenticated;
grant execute on function public.cw_story_open(uuid, text, text, int, int) to anon, authenticated;
grant execute on function public.cw_story_save(uuid, text, text, int, int, int, int, text) to anon, authenticated;
grant execute on function public.cw_swap(uuid, text, text, int, int, text) to anon, authenticated;
grant execute on function public.cw_submit(uuid, text, text, int) to anon, authenticated;
grant execute on function public.cw_teacher_list(text, text, int) to anon, authenticated;
grant execute on function public.cw_teacher_return(text, text, uuid, int) to anon, authenticated;
grant execute on function public.cw_teacher_posted(text, text, uuid, int, int) to anon, authenticated;
grant execute on function public.cw_teacher_live(text, boolean) to anon, authenticated;
