-- ============================================================
-- Ask Mr. Dopp — anonymous student questions. Safe to re-run. Added 2026-11-03.
--
-- • Only signed-in students can ask (keeps out spam from outside the class),
--   but a question is saved WITHOUT the student: ask_questions has no student column
--   and stores only the day, not the time, so a question can't be traced to a name.
-- • ask_limits counts how many questions a student sent each day (max 3) and nothing else.
-- • The teacher (dashboard passphrase, _teacher_ok) reads every question, writes an answer,
--   and chooses to post it to the class board or keep it for answering out loud in class.
-- • Students see only questions the teacher posted, with his answer.
-- ============================================================

create table if not exists public.ask_questions (
  id          uuid primary key default gen_random_uuid(),
  trimester   text not null,
  day         date not null default ((now() at time zone 'America/Boise')::date),
  topic       text not null default 'Health question',
  body        text not null check (char_length(body) between 3 and 1000),
  answer      text,
  status      text not null default 'new' check (status in ('new', 'posted', 'in_class', 'skipped')),
  answered_on date
);
create index if not exists ask_questions_tri on public.ask_questions (trimester, status);
alter table public.ask_questions enable row level security;   -- no policies: only the functions below can touch it

create table if not exists public.ask_limits (
  student_id uuid not null references public.students(id) on delete cascade,
  day        date not null,
  n          int  not null default 0,
  primary key (student_id, day)
);
alter table public.ask_limits enable row level security;

-- ---------- student ----------
create or replace function public.ask_submit(p_student_id uuid, p_pin_hash text, p_trimester text, p_topic text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Boise')::date; used int; v_body text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  if char_length(v_body) < 3 then raise exception 'Please type your question'; end if;
  if char_length(v_body) > 1000 then raise exception 'Please keep it under 1000 characters'; end if;
  select n into used from public.ask_limits where student_id = p_student_id and day = d;
  if coalesce(used, 0) >= 3 then raise exception 'You can ask 3 questions a day. Try again tomorrow!'; end if;
  insert into public.ask_limits (student_id, day, n) values (p_student_id, d, 1)
    on conflict (student_id, day) do update set n = public.ask_limits.n + 1;
  insert into public.ask_questions (trimester, day, topic, body)
    values (p_trimester, d, left(coalesce(nullif(btrim(p_topic), ''), 'Health question'), 60), v_body);
  return jsonb_build_object('ok', true, 'left_today', 2 - coalesce(used, 0));
end $$;

-- The class board: answered questions the teacher posted, newest first.
create or replace function public.ask_board(p_student_id uuid, p_pin_hash text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.students s where s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = p_trimester)
    then raise exception 'not signed in'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('topic', q.topic, 'body', q.body, 'answer', q.answer, 'answered_on', q.answered_on)
      order by q.answered_on desc nulls last, q.day desc)
    from public.ask_questions q where q.trimester = p_trimester and q.status = 'posted'), '[]'::jsonb);
end $$;

-- ---------- teacher ----------
create or replace function public.ask_teacher_list(p_teacher_pass text, p_trimester text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'day', q.day, 'topic', q.topic, 'body', q.body,
      'answer', q.answer, 'status', q.status, 'answered_on', q.answered_on)
      order by (q.status = 'new') desc, q.day desc)
    from public.ask_questions q where q.trimester = p_trimester), '[]'::jsonb);
end $$;

-- p_status: 'posted' (show on class board), 'in_class' (answered out loud), 'skipped', or 'new'.
-- p_body lets the teacher tidy the wording (typos, names) before posting; null keeps it.
create or replace function public.ask_teacher_set(p_teacher_pass text, p_trimester text, p_id uuid, p_answer text, p_status text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  if p_status not in ('new', 'posted', 'in_class', 'skipped') then raise exception 'bad status'; end if;
  if p_status = 'posted' and char_length(btrim(coalesce(p_answer, ''))) = 0 then raise exception 'Write an answer before posting'; end if;
  update public.ask_questions set
    answer = left(nullif(btrim(coalesce(p_answer, '')), ''), 4000),
    body = case when char_length(btrim(coalesce(p_body, ''))) >= 3 then left(btrim(p_body), 1000) else body end,
    status = p_status,
    answered_on = case when p_status in ('posted', 'in_class') then coalesce(answered_on, (now() at time zone 'America/Boise')::date) else null end
  where id = p_id and trimester = p_trimester;
  return public.ask_teacher_list(p_teacher_pass, p_trimester);
end $$;

create or replace function public.ask_teacher_delete(p_teacher_pass text, p_trimester text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._teacher_ok(p_teacher_pass) then raise exception 'not allowed'; end if;
  delete from public.ask_questions where id = p_id and trimester = p_trimester;
  return public.ask_teacher_list(p_teacher_pass, p_trimester);
end $$;

grant execute on function public.ask_submit(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.ask_board(uuid, text, text) to anon, authenticated;
grant execute on function public.ask_teacher_list(text, text) to anon, authenticated;
grant execute on function public.ask_teacher_set(text, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.ask_teacher_delete(text, text, uuid) to anon, authenticated;
