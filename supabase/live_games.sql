-- ============================================================
-- Live class games (Pick a Side Live, Vocab Showdown, Realm Raid)
-- Paste into Supabase > SQL Editor > New query > Run.
-- Safe to re-run. Does not touch existing tables.
-- All tables are locked (RLS on, no policies); everything goes
-- through the functions below.
-- ============================================================

-- ---------- Tables ----------

-- One row: the teacher passphrase (bcrypt hash). Set separately.
create table if not exists public.live_teacher_key (
  id        int primary key default 1 check (id = 1),
  pass_hash text not null
);
alter table public.live_teacher_key enable row level security;

create table if not exists public.live_sessions (
  id              uuid primary key default gen_random_uuid(),
  join_code       text not null,
  game_type       text not null check (game_type in ('pick_a_side','showdown','raid')),
  host_token_hash text not null,
  phase           text not null default 'lobby'
                  check (phase in ('lobby','question','reveal','leaderboard','ended')),
  q_index         int  not null default -1,
  question        jsonb,          -- public: prompt + choices
  answer_key      text,           -- hidden until reveal; null for polls
  q_seconds       int,
  q_started_at    timestamptz,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);
alter table public.live_sessions enable row level security;
create unique index if not exists live_sessions_open_code
  on public.live_sessions (join_code) where phase <> 'ended';

create table if not exists public.live_players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  nickname   text not null check (char_length(nickname) between 1 and 24),
  team       int check (team between 1 and 4),
  token_hash text not null,
  joined_at  timestamptz not null default now()
);
alter table public.live_players enable row level security;
create index if not exists live_players_session on public.live_players (session_id);
create unique index if not exists live_players_one_per_student
  on public.live_players (session_id, student_id) where student_id is not null;

create table if not exists public.live_answers (
  session_id  uuid not null references public.live_sessions(id) on delete cascade,
  player_id   uuid not null references public.live_players(id) on delete cascade,
  q_index     int  not null,
  answer      text not null check (char_length(answer) <= 40),
  is_correct  boolean,            -- null for polls
  points      int  not null default 0,
  answered_at timestamptz not null default now(),
  primary key (player_id, q_index)
);
alter table public.live_answers enable row level security;
create index if not exists live_answers_session_q on public.live_answers (session_id, q_index);

-- ---------- Teacher (host) functions ----------

-- Start a game. Needs the teacher passphrase. Returns a host_token
-- that the host screen keeps; every other host action needs it.
create or replace function public.create_live_session(
  p_teacher_pass text, p_game_type text, p_settings jsonb default '{}'::jsonb)
returns table(session_id uuid, join_code text, host_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_token text := gen_random_uuid()::text;
  v_code  text;
  v_id    uuid;
begin
  if not exists (select 1 from public.live_teacher_key k
                 where k.pass_hash = extensions.crypt(p_teacher_pass, k.pass_hash)) then
    raise exception 'Wrong teacher passphrase';
  end if;

  -- auto-close games left open more than 12 hours
  update public.live_sessions s set phase = 'ended', ended_at = now()
   where s.phase <> 'ended' and s.created_at < now() - interval '12 hours';

  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.live_sessions s
                          where s.join_code = v_code and s.phase <> 'ended');
  end loop;

  insert into public.live_sessions (join_code, game_type, host_token_hash, settings)
  values (v_code, p_game_type,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          coalesce(p_settings, '{}'::jsonb))
  returning id into v_id;

  return query select v_id, v_code, v_token;
end $$;

-- Show a question. p_answer_key = correct choice (null for polls).
create or replace function public.host_set_question(
  p_session_id uuid, p_host_token text, p_q_index int,
  p_question jsonb, p_answer_key text, p_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions s
     set phase = 'question', q_index = p_q_index, question = p_question,
         answer_key = p_answer_key, q_seconds = p_seconds, q_started_at = now()
   where s.id = p_session_id
     and s.host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
     and s.phase <> 'ended';
  return found;
end $$;

-- Move to lobby / reveal / leaderboard / ended.
create or replace function public.host_set_phase(
  p_session_id uuid, p_host_token text, p_phase text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_phase not in ('lobby','reveal','leaderboard','ended') then
    raise exception 'Bad phase';
  end if;
  update public.live_sessions s
     set phase = p_phase,
         ended_at = case when p_phase = 'ended' then now() else s.ended_at end
   where s.id = p_session_id
     and s.host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
     and s.phase <> 'ended';
  return found;
end $$;

-- Scores, per-question tally, team totals. Host only.
create or replace function public.host_get_results(
  p_session_id uuid, p_host_token text)
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nickname', p.nickname, 'team', p.team,
               'signed_in', p.student_id is not null,
               'score', coalesce(sc.score, 0), 'correct', coalesce(sc.correct, 0),
               'answered_current', exists (select 1 from public.live_answers a2
                                           where a2.player_id = p.id and a2.q_index = s.q_index))
             order by coalesce(sc.score, 0) desc, p.joined_at), '[]'::jsonb)
      from public.live_players p
      left join (select a.player_id, sum(a.points) as score,
                        count(*) filter (where a.is_correct) as correct
                   from public.live_answers a where a.session_id = s.id
                  group by a.player_id) sc on sc.player_id = p.id
      where p.session_id = s.id),
    'tally', (
      select coalesce(jsonb_object_agg(t.answer, t.n), '{}'::jsonb)
      from (select a.answer, count(*) as n from public.live_answers a
             where a.session_id = s.id and a.q_index = s.q_index
             group by a.answer) t),
    'teams', (
      select coalesce(jsonb_object_agg(t.team::text, t.correct), '{}'::jsonb)
      from (select p.team, count(a.*) filter (where a.is_correct) as correct
              from public.live_players p
              left join public.live_answers a on a.player_id = p.id
             where p.session_id = s.id and p.team is not null
             group by p.team) t)
  )
  from public.live_sessions s
  where s.id = p_session_id
    and s.host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
$$;

-- ---------- Student (player) functions ----------

-- Join with the 6-digit code. Either a Quest login (student id +
-- pin hash) or just a nickname, if the game allows it.
create or replace function public.join_live_session(
  p_join_code text, p_nickname text,
  p_student_id uuid default null, p_pin_hash text default null,
  p_trimester text default null)
returns table(session_id uuid, player_id uuid, player_token text,
              game_type text, team int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_s     public.live_sessions;
  v_token text := gen_random_uuid()::text;
  v_hash  text;
  v_pid   uuid;
  v_name  text;
  v_team  int;
  v_n     int;
begin
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select * into v_s from public.live_sessions s
   where s.join_code = btrim(p_join_code) and s.phase <> 'ended'
   order by s.created_at desc limit 1;
  if not found then raise exception 'No game with that code'; end if;

  if p_student_id is not null then
    select coalesce(nullif(btrim(st.display_name), ''), st.last_name) into v_name
      from public.students st
     where st.id = p_student_id and st.pin_hash = p_pin_hash
       and st.trimester = p_trimester;
    if not found then raise exception 'Login expired - sign in again on the Quest page'; end if;
    v_name := left(coalesce(v_name, 'Student'), 24);

    -- rejoining (refresh / new device): keep same player, new token
    select p.id, p.team into v_pid, v_team from public.live_players p
     where p.session_id = v_s.id and p.student_id = p_student_id;
    if v_pid is not null then
      update public.live_players p set token_hash = v_hash where p.id = v_pid;
      return query select v_s.id, v_pid, v_token, v_s.game_type, v_team;
      return;
    end if;
  else
    if coalesce(v_s.settings->>'require_login', 'false') = 'true' then
      raise exception 'This game needs your Quest login';
    end if;
    v_name := left(btrim(coalesce(p_nickname, '')), 24);
    if v_name = '' then raise exception 'Enter a nickname'; end if;
  end if;

  select count(*) into v_n from public.live_players p where p.session_id = v_s.id;
  if v_n >= 200 then raise exception 'Game is full'; end if;
  if coalesce(v_s.settings->>'teams', '') ~ '^[2-4]$' then
    v_team := (v_n % (v_s.settings->>'teams')::int) + 1;
  end if;

  insert into public.live_players (session_id, student_id, nickname, team, token_hash)
  values (v_s.id, p_student_id, v_name, v_team, v_hash)
  returning id into v_pid;

  return query select v_s.id, v_pid, v_token, v_s.game_type, v_team;
end $$;

-- Answer the current question. Server checks timing and correctness.
-- Quiz answers are final; poll answers can be changed until reveal.
create or replace function public.submit_live_answer(
  p_player_id uuid, p_player_token text, p_q_index int, p_answer text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_p       public.live_players;
  v_s       public.live_sessions;
  v_elapsed numeric;
  v_correct boolean;
  v_pts     int := 0;
begin
  select * into v_p from public.live_players p
   where p.id = p_player_id
     and p.token_hash = encode(extensions.digest(p_player_token, 'sha256'), 'hex');
  if not found then return false; end if;

  select * into v_s from public.live_sessions s where s.id = v_p.session_id;
  if v_s.phase <> 'question' or v_s.q_index <> p_q_index then return false; end if;

  v_elapsed := extract(epoch from now() - v_s.q_started_at);
  if v_s.q_seconds is not null and v_elapsed > v_s.q_seconds + 2 then return false; end if;

  if v_s.answer_key is not null then
    v_correct := (p_answer = v_s.answer_key);
    if v_correct then  -- 500 for correct + up to 500 speed bonus
      v_pts := 500 + greatest(0, round(500 * (1 - v_elapsed / greatest(coalesce(v_s.q_seconds, 20), 1))))::int;
    end if;
  end if;

  insert into public.live_answers (session_id, player_id, q_index, answer, is_correct, points)
  values (v_s.id, v_p.id, p_q_index, left(p_answer, 40), v_correct, v_pts)
  on conflict (player_id, q_index) do update
     set answer = excluded.answer, answered_at = now()
   where public.live_answers.is_correct is null;  -- polls only
  return found;
end $$;

-- What everyone sees (projector + phones). Correct answer only after
-- reveal. Pass player id/token to also get "my" score and answer.
create or replace function public.get_live_state(
  p_session_id uuid, p_player_id uuid default null, p_player_token text default null)
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'phase', s.phase, 'game_type', s.game_type, 'q_index', s.q_index,
    'question', s.question, 'q_seconds', s.q_seconds,
    'seconds_left', case when s.phase = 'question' and s.q_seconds is not null
                    then greatest(0, s.q_seconds - extract(epoch from now() - s.q_started_at))::int end,
    'answer_key', case when s.phase in ('reveal','leaderboard','ended') then s.answer_key end,
    'player_count', (select count(*) from public.live_players p where p.session_id = s.id),
    'answer_count', (select count(*) from public.live_answers a
                      where a.session_id = s.id and a.q_index = s.q_index),
    'teams', case when s.game_type = 'raid' then (
       select coalesce(jsonb_object_agg(t.team::text, t.correct), '{}'::jsonb)
       from (select p.team, count(a.*) filter (where a.is_correct) as correct
               from public.live_players p
               left join public.live_answers a on a.player_id = p.id
              where p.session_id = s.id and p.team is not null
              group by p.team) t) end,
    'me', (select jsonb_build_object(
             'nickname', p.nickname, 'team', p.team,
             'score', (select coalesce(sum(a.points), 0) from public.live_answers a where a.player_id = p.id),
             'my_answer', (select a.answer from public.live_answers a
                            where a.player_id = p.id and a.q_index = s.q_index),
             'my_correct', case when s.phase in ('reveal','leaderboard','ended') then
                             (select a.is_correct from public.live_answers a
                               where a.player_id = p.id and a.q_index = s.q_index) end)
           from public.live_players p
           where p.id = p_player_id and p.session_id = s.id
             and p.token_hash = encode(extensions.digest(coalesce(p_player_token, ''), 'sha256'), 'hex'))
  )
  from public.live_sessions s
  where s.id = p_session_id;
$$;
