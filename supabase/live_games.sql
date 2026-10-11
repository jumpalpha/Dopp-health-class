-- ============================================================
-- Live class games (Pick a Side Live, Vocab Showdown, Realm Raid)
-- + substitute day-pass codes (start games only; expire automatically)
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

-- ---------- Verified XP log (also defined in verified_xp.sql) ----------
create table if not exists public.xp_events (
  id         bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  trimester  text not null,
  source     text not null,
  ref        text not null,
  xp         int  not null check (xp > 0 and xp <= 500),
  created_at timestamptz not null default now(),
  unique (student_id, ref)
);
alter table public.xp_events enable row level security;

-- ---------- Substitute codes ----------
-- Day-pass codes that can start live games only. Stored scrambled (bcrypt).
create table if not exists public.live_sub_codes (
  id         bigserial primary key,
  code_hash  text not null,
  label      text,
  expires_at timestamptz not null,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.live_sub_codes enable row level security;
alter table public.live_sessions add column if not exists started_by text not null default 'teacher';

-- Who is this? 'teacher' (passphrase), 'sub' (valid, unexpired sub code) or null.
create or replace function public._host_auth(p_pass text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.live_teacher_key k
                 where k.pass_hash = extensions.crypt(coalesce(p_pass, ''), k.pass_hash)) then 'teacher'
    when exists (select 1 from public.live_sub_codes c
                 where not c.revoked and c.expires_at > now()
                   and c.code_hash = extensions.crypt(upper(btrim(coalesce(p_pass, ''))), c.code_hash)) then 'sub'
  end;
$$;
revoke execute on function public._host_auth(text) from public, anon, authenticated;

-- Teacher only: make a sub code good through the end of p_until (Idaho time).
create or replace function public.create_sub_code(p_teacher_pass text, p_until date, p_label text default null)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  words text[] := array['FALCON','CEDAR','HARBOR','MAPLE','SUMMIT','EMBER','CANYON','WILLOW','COPPER','MEADOW',
                        'LANTERN','RAVEN','ORCHARD','PEBBLE','THUNDER','PRAIRIE','GLACIER','TIMBER','JUNIPER','COBALT'];
  v_code text; v_exp timestamptz;
  today date := (now() at time zone 'America/Denver')::date;
begin
  if public._host_auth(p_teacher_pass) is distinct from 'teacher' then
    raise exception 'Wrong teacher passphrase';
  end if;
  if p_until is null or p_until < today then raise exception 'Pick today or a later date'; end if;
  if p_until > today + 14 then raise exception 'Sub codes can last at most 14 days'; end if;
  delete from public.live_sub_codes c where c.expires_at < now() - interval '30 days';
  v_code := words[1 + floor(random() * array_length(words, 1))::int] || '-' || lpad((floor(random() * 1000))::int::text, 3, '0');
  v_exp := ((p_until + 1)::timestamp at time zone 'America/Denver');
  insert into public.live_sub_codes (code_hash, label, expires_at)
  values (extensions.crypt(v_code, extensions.gen_salt('bf')), left(btrim(coalesce(p_label, '')), 60), v_exp);
  return query select v_code, v_exp;
end $$;

-- Teacher only: list codes (never shows the codes themselves).
create or replace function public.list_sub_codes(p_teacher_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public._host_auth(p_teacher_pass) is distinct from 'teacher' then
    raise exception 'Wrong teacher passphrase';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', c.id, 'label', c.label, 'expires_at', c.expires_at, 'created_at', c.created_at,
            'active', not c.revoked and c.expires_at > now(), 'revoked', c.revoked)
          order by c.created_at desc), '[]'::jsonb)
          from public.live_sub_codes c where c.expires_at > now() - interval '7 days');
end $$;

-- Teacher only: cancel a code early.
create or replace function public.revoke_sub_code(p_teacher_pass text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public._host_auth(p_teacher_pass) is distinct from 'teacher' then
    raise exception 'Wrong teacher passphrase';
  end if;
  update public.live_sub_codes set revoked = true where id = p_id;
  return found;
end $$;

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
  v_role  text;
begin
  v_role := public._host_auth(p_teacher_pass);   -- teacher passphrase or valid sub code
  if v_role is null then
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

  insert into public.live_sessions (join_code, game_type, host_token_hash, settings, started_by)
  values (v_code, p_game_type,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          coalesce(p_settings, '{}'::jsonb), v_role)
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

-- Raid: record the boss's HP (set by the host screen when the raid starts).
create or replace function public.host_set_hp(p_session_id uuid, p_host_token text, p_hp int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions s set settings = s.settings || jsonb_build_object('hp', greatest(1, least(p_hp, 5000)))
   where s.id = p_session_id and s.game_type = 'raid'
     and s.host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex') and s.phase <> 'ended';
  return found;
end $$;

-- End-of-game bonuses (once per game): Showdown top 3 (+25 each);
-- Raid: if the boss fell, every signed-in player on the team with the most hits (+25).
create or replace function public._live_award_bonus(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_s public.live_sessions; v_hp int; v_total int; v_team int;
begin
  select * into v_s from public.live_sessions where id = p_session_id;
  if v_s.game_type = 'showdown' then
    insert into public.xp_events (student_id, trimester, source, ref, xp)
    select r.student_id, st.trimester, 'live_bonus', 'live_bonus:' || p_session_id, 25
      from (select p.student_id, sum(a.points) as score
              from public.live_players p join public.live_answers a on a.player_id = p.id
             where p.session_id = p_session_id and p.student_id is not null
             group by p.student_id having sum(a.points) > 0
             order by sum(a.points) desc limit 3) r
      join public.students st on st.id = r.student_id
    on conflict (student_id, ref) do nothing;
  elsif v_s.game_type = 'raid' then
    v_hp := nullif(v_s.settings->>'hp', '')::int;
    select count(*) into v_total from public.live_answers a where a.session_id = p_session_id and a.is_correct;
    if v_hp is not null and v_total >= v_hp then
      select p.team into v_team from public.live_players p join public.live_answers a on a.player_id = p.id
       where p.session_id = p_session_id and a.is_correct and p.team is not null
       group by p.team order by count(*) desc limit 1;
      insert into public.xp_events (student_id, trimester, source, ref, xp)
      select p.student_id, st.trimester, 'live_bonus', 'live_bonus:' || p_session_id, 25
        from public.live_players p join public.students st on st.id = p.student_id
       where p.session_id = p_session_id and p.team = v_team
      on conflict (student_id, ref) do nothing;
    end if;
  end if;
end $$;
revoke execute on function public._live_award_bonus(uuid) from public, anon, authenticated;

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
  if not found then return false; end if;
  if p_phase = 'ended' then perform public._live_award_bonus(p_session_id); end if;
  return true;
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
  if not found then return false; end if;

  -- Verified XP: +5 per correct answer for signed-in students
  if v_correct and v_p.student_id is not null and v_s.game_type in ('showdown','raid') then
    insert into public.xp_events (student_id, trimester, source, ref, xp)
    select v_p.student_id, st.trimester, 'live', 'live:' || v_s.id || ':' || p_q_index, 5
      from public.students st where st.id = v_p.student_id
    on conflict (student_id, ref) do nothing;
  end if;
  return true;
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
             'nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
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
