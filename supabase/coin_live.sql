-- ============================================================
-- Coin Quest Live (game_type 'coins') — Gimkit-style live game.
-- Every student answers at their own pace for a set time; right
-- answers earn coins; coins buy upgrades. Optional teams: a team's
-- score is the sum of its members' coins (wallets stay separate,
-- so a teammate can't spend your coins).
-- The server keeps the answer key, checks every answer and prices
-- every upgrade, so scores can't be faked from the browser.
-- Builds on live_games.sql. Safe to re-run.
-- ============================================================

alter table public.live_sessions drop constraint if exists live_sessions_game_type_check;
alter table public.live_sessions add constraint live_sessions_game_type_check
  check (game_type in ('pick_a_side','showdown','raid','coins'));

-- The questions for one game (loaded by the host screen at setup).
create table if not exists public.live_coin_bank (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  idx        int  not null,
  ch         int,
  prompt     text not null,
  choices    jsonb not null,      -- 4 strings
  answer     text not null,
  why        text,
  primary key (session_id, idx)
);
alter table public.live_coin_bank enable row level security;

-- Each player's wallet and upgrades.
create table if not exists public.live_coin_players (
  player_id  uuid primary key references public.live_players(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  cash       bigint not null default 0,
  earned     bigint not null default 0,
  l_mpq      int not null default 0,
  l_mult     int not null default 0,
  l_streak   int not null default 0,
  l_ins      int not null default 0,
  streak     int not null default 0,
  cur_q      int,
  answered   int not null default 0,
  correct    int not null default 0,
  last_at    timestamptz
);
alter table public.live_coin_players enable row level security;
create index if not exists live_coin_players_session on public.live_coin_players (session_id, cash desc);

-- Upgrade values and prices (same as the solo Coin Quest page).
create or replace function public._coin_val(p_kind text, p_lvl int)
returns numeric language sql immutable as $$
  select (case p_kind
    when 'mpq'    then array[10,25,60,150,400,1000,2500]::numeric[]
    when 'mult'   then array[1,1.5,2,3,4]::numeric[]
    when 'streak' then array[0,5,15,40,100,250]::numeric[]
    when 'ins'    then array[0,.25,.5,.75,1]::numeric[] end)[p_lvl + 1];
$$;
create or replace function public._coin_cost(p_kind text, p_lvl int)
returns bigint language sql immutable as $$
  select (case p_kind
    when 'mpq'    then array[0,50,200,700,2500,8000,25000]::bigint[]
    when 'mult'   then array[0,100,500,2500,10000]::bigint[]
    when 'streak' then array[0,40,180,700,2500,8000]::bigint[]
    when 'ins'    then array[0,60,300,1500,6000]::bigint[] end)[p_lvl + 1];
$$;

create or replace function public._coin_host_ok(p_session_id uuid, p_host_token text)
returns public.live_sessions language sql stable security definer set search_path = public as $$
  select s.* from public.live_sessions s
   where s.id = p_session_id and s.game_type = 'coins'
     and s.host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
$$;
revoke execute on function public._coin_host_ok(uuid, text) from public, anon, authenticated;

-- Host: load the question bank (lobby only). p_questions = [{ch, prompt, choices:[4], answer, why}]
create or replace function public.host_coin_setup(p_session_id uuid, p_host_token text, p_questions jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_s public.live_sessions; v_n int;
begin
  v_s := public._coin_host_ok(p_session_id, p_host_token);
  if v_s.id is null then raise exception 'Not your game'; end if;
  if v_s.phase <> 'lobby' then raise exception 'Game already started'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 4 and 800 then
    raise exception 'Need 4 to 800 questions';
  end if;
  delete from public.live_coin_bank b where b.session_id = p_session_id;
  insert into public.live_coin_bank (session_id, idx, ch, prompt, choices, answer, why)
  select p_session_id, (q.ord - 1)::int, nullif(q.v->>'ch', '')::int, left(q.v->>'prompt', 400),
         q.v->'choices', left(q.v->>'answer', 200), left(q.v->>'why', 600)
    from jsonb_array_elements(p_questions) with ordinality as q(v, ord)
   where jsonb_typeof(q.v->'choices') = 'array' and coalesce(q.v->>'prompt', '') <> '' and coalesce(q.v->>'answer', '') <> '';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Host: start the clock.
create or replace function public.host_coin_start(p_session_id uuid, p_host_token text, p_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_s public.live_sessions;
begin
  v_s := public._coin_host_ok(p_session_id, p_host_token);
  if v_s.id is null or v_s.phase <> 'lobby' then return false; end if;
  if not exists (select 1 from public.live_coin_bank b where b.session_id = p_session_id) then raise exception 'No questions loaded'; end if;
  update public.live_sessions s
     set phase = 'question', q_index = 0, q_started_at = now(), q_seconds = greatest(60, least(coalesce(p_seconds, 420), 1800))
   where s.id = p_session_id;
  return true;
end $$;

-- Host: live leaderboard.
create or replace function public.host_coin_board(p_session_id uuid, p_host_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.live_sessions;
begin
  v_s := public._coin_host_ok(p_session_id, p_host_token);
  if v_s.id is null then return null; end if;
  return jsonb_build_object(
    'phase', v_s.phase,
    'seconds_left', case when v_s.phase = 'question' then greatest(0, v_s.q_seconds - extract(epoch from now() - v_s.q_started_at))::int end,
    'q_seconds', v_s.q_seconds,
    'teams_n', nullif(v_s.settings->>'teams', '')::int,
    'bank', (select count(*) from public.live_coin_bank b where b.session_id = v_s.id),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
        'cash', coalesce(c.cash, 0), 'correct', coalesce(c.correct, 0), 'answered', coalesce(c.answered, 0))
        order by coalesce(c.cash, 0) desc, p.joined_at), '[]'::jsonb)
      from public.live_players p left join public.live_coin_players c on c.player_id = p.id
      where p.session_id = v_s.id),
    'teams', (select coalesce(jsonb_object_agg(t.team::text, t.cash), '{}'::jsonb)
      from (select p.team, sum(coalesce(c.cash, 0)) as cash
              from public.live_players p left join public.live_coin_players c on c.player_id = p.id
             where p.session_id = v_s.id and p.team is not null group by p.team) t),
    'answered', (select coalesce(sum(c.answered), 0) from public.live_coin_players c where c.session_id = v_s.id),
    'correct', (select coalesce(sum(c.correct), 0) from public.live_coin_players c where c.session_id = v_s.id)
  );
end $$;

-- ---------- player side ----------

-- Shared: check token, make the wallet row, return (player, session, wallet).
create or replace function public._coin_player(p_player_id uuid, p_token text,
  out o_p public.live_players, out o_s public.live_sessions, out o_c public.live_coin_players)
language plpgsql security definer set search_path = public as $$
begin
  select * into o_p from public.live_players p
   where p.id = p_player_id and p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if o_p.id is null then raise exception 'Not in this game'; end if;
  select * into o_s from public.live_sessions s where s.id = o_p.session_id and s.game_type = 'coins';
  if o_s.id is null then raise exception 'Not a Coin Quest game'; end if;
  insert into public.live_coin_players (player_id, session_id) values (o_p.id, o_s.id) on conflict do nothing;
  select * into o_c from public.live_coin_players c where c.player_id = o_p.id for update;
end $$;
revoke execute on function public._coin_player(uuid, text) from public, anon, authenticated;

create or replace function public._coin_running(s public.live_sessions, p_grace int default 0)
returns boolean language sql stable as $$
  select s.phase = 'question' and s.q_started_at is not null
     and now() <= s.q_started_at + make_interval(secs => s.q_seconds + p_grace);
$$;

-- A random question for this player (never the one they just had).
create or replace function public._coin_pick(p_session_id uuid, p_not int)
returns int language sql volatile security definer set search_path = public as $$
  select b.idx from public.live_coin_bank b
   where b.session_id = p_session_id and b.idx is distinct from p_not
   order by random() limit 1;
$$;
revoke execute on function public._coin_pick(uuid, int) from public, anon, authenticated;

-- What my phone shows.
create or replace function public._coin_view(p_p public.live_players, p_s public.live_sessions, p_c public.live_coin_players)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'phase', p_s.phase,
    'running', public._coin_running(p_s),
    'seconds_left', case when p_s.phase = 'question' then greatest(0, p_s.q_seconds - extract(epoch from now() - p_s.q_started_at))::int end,
    'nickname', p_p.nickname, 'team', p_p.team, 'signed_in', p_p.student_id is not null,
    'cash', p_c.cash, 'earned', p_c.earned, 'streak', p_c.streak,
    'answered', p_c.answered, 'correct', p_c.correct,
    'lv', jsonb_build_object('mpq', p_c.l_mpq, 'mult', p_c.l_mult, 'streak', p_c.l_streak, 'ins', p_c.l_ins),
    'rank', (select count(*) + 1 from public.live_coin_players c2 where c2.session_id = p_s.id and c2.cash > p_c.cash),
    'players', (select count(*) from public.live_players p2 where p2.session_id = p_s.id),
    'teams', case when p_p.team is not null then (
       select coalesce(jsonb_object_agg(t.team::text, t.cash), '{}'::jsonb)
         from (select p3.team, sum(coalesce(c3.cash, 0)) as cash
                 from public.live_players p3 left join public.live_coin_players c3 on c3.player_id = p3.id
                where p3.session_id = p_s.id and p3.team is not null group by p3.team) t) end,
    'question', case when public._coin_running(p_s) and p_c.cur_q is not null then (
       select jsonb_build_object('idx', b.idx, 'ch', b.ch, 'prompt', b.prompt, 'choices', b.choices)
         from public.live_coin_bank b where b.session_id = p_s.id and b.idx = p_c.cur_q) end);
$$;
revoke execute on function public._coin_view(public.live_players, public.live_sessions, public.live_coin_players) from public, anon, authenticated;

create or replace function public.coin_me(p_player_id uuid, p_player_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_c public.live_coin_players; v_p public.live_players; v_s public.live_sessions;
begin
  select * into r from public._coin_player(p_player_id, p_player_token);
  v_c := r.o_c; v_p := r.o_p; v_s := r.o_s;
  if public._coin_running(v_s) and v_c.cur_q is null then
    update public.live_coin_players c set cur_q = public._coin_pick(v_s.id, null)
     where c.player_id = v_p.id returning * into v_c;
  end if;
  return public._coin_view(v_p, v_s, v_c);
end $$;

-- Answer my current question. Returns the result plus my new view.
create or replace function public.coin_answer(p_player_id uuid, p_player_token text, p_idx int, p_answer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; b public.live_coin_bank; v_ok boolean; v_delta bigint := 0; v_c public.live_coin_players; v_p public.live_players; v_s public.live_sessions;
begin
  select * into r from public._coin_player(p_player_id, p_player_token);
  v_c := r.o_c; v_p := r.o_p; v_s := r.o_s;
  if not public._coin_running(v_s, 2) then raise exception 'Time is up'; end if;
  if v_c.cur_q is null or v_c.cur_q <> p_idx then
    return jsonb_build_object('stale', true, 'me', public._coin_view(v_p, v_s, v_c));
  end if;
  if v_c.last_at is not null and now() - v_c.last_at < interval '600 milliseconds' then raise exception 'Too fast'; end if;
  select * into b from public.live_coin_bank x where x.session_id = v_s.id and x.idx = p_idx;
  v_ok := btrim(coalesce(p_answer, '')) = btrim(b.answer);
  if v_ok then
    v_delta := round((public._coin_val('mpq', v_c.l_mpq) + public._coin_val('streak', v_c.l_streak) * least(v_c.streak, 10))
                     * public._coin_val('mult', v_c.l_mult));
    update public.live_coin_players c
       set cash = c.cash + v_delta, earned = c.earned + v_delta, streak = c.streak + 1,
           answered = c.answered + 1, correct = c.correct + 1, last_at = now(),
           cur_q = public._coin_pick(v_s.id, p_idx)
     where c.player_id = v_p.id returning * into v_c;
    -- Verified XP: +5 for each of the first 15 right answers per game
    if v_p.student_id is not null and v_c.correct <= 15 then
      insert into public.xp_events (student_id, trimester, source, ref, xp)
      select v_p.student_id, st.trimester, 'live', 'live:' || v_s.id || ':c' || v_c.correct, 5
        from public.students st where st.id = v_p.student_id
      on conflict (student_id, ref) do nothing;
    end if;
  else
    v_delta := - least(v_c.cash, round(public._coin_val('mpq', v_c.l_mpq) * 0.5 * (1 - public._coin_val('ins', v_c.l_ins)))::bigint);
    update public.live_coin_players c
       set cash = c.cash + v_delta, streak = 0, answered = c.answered + 1, last_at = now(),
           cur_q = public._coin_pick(v_s.id, p_idx)
     where c.player_id = v_p.id returning * into v_c;
  end if;
  return jsonb_build_object('correct', v_ok, 'answer', b.answer, 'why', b.why, 'delta', v_delta,
                            'me', public._coin_view(v_p, v_s, v_c));
end $$;

-- Buy the next level of an upgrade.
create or replace function public.coin_buy(p_player_id uuid, p_player_token text, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_lvl int; v_cost bigint; v_c public.live_coin_players; v_p public.live_players; v_s public.live_sessions;
begin
  if p_kind not in ('mpq','mult','streak','ins') then raise exception 'Unknown upgrade'; end if;
  select * into r from public._coin_player(p_player_id, p_player_token);
  v_c := r.o_c; v_p := r.o_p; v_s := r.o_s;
  if not public._coin_running(v_s, 2) then raise exception 'Time is up'; end if;
  v_lvl := case p_kind when 'mpq' then v_c.l_mpq when 'mult' then v_c.l_mult when 'streak' then v_c.l_streak else v_c.l_ins end;
  v_cost := public._coin_cost(p_kind, v_lvl + 1);
  if v_cost is null then raise exception 'Already maxed'; end if;
  if v_cost > v_c.cash then raise exception 'Not enough coins'; end if;
  update public.live_coin_players c
     set cash = c.cash - v_cost,
         l_mpq    = c.l_mpq    + (p_kind = 'mpq')::int,
         l_mult   = c.l_mult   + (p_kind = 'mult')::int,
         l_streak = c.l_streak + (p_kind = 'streak')::int,
         l_ins    = c.l_ins    + (p_kind = 'ins')::int
   where c.player_id = v_p.id returning * into v_c;
  return public._coin_view(v_p, v_s, v_c);
end $$;

grant execute on function public.host_coin_setup(uuid, text, jsonb), public.host_coin_start(uuid, text, int),
  public.host_coin_board(uuid, text), public.coin_me(uuid, text), public.coin_answer(uuid, text, int, text),
  public.coin_buy(uuid, text, text) to anon, authenticated;

-- ---------- end-of-game bonus (adds Coin Quest Live to live_games.sql's version) ----------
-- Showdown top 3 (+25 each); Raid: winning team if the boss fell (+25);
-- Coin Quest Live: top 3 by coins (+25), or with teams, everyone on the richest team (+25).
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
  elsif v_s.game_type = 'coins' then
    if nullif(v_s.settings->>'teams', '') is not null then
      select p.team into v_team from public.live_players p join public.live_coin_players c on c.player_id = p.id
       where p.session_id = p_session_id and p.team is not null
       group by p.team having sum(c.cash) > 0 order by sum(c.cash) desc limit 1;
      insert into public.xp_events (student_id, trimester, source, ref, xp)
      select p.student_id, st.trimester, 'live_bonus', 'live_bonus:' || p_session_id, 25
        from public.live_players p join public.students st on st.id = p.student_id
       where p.session_id = p_session_id and p.team = v_team
      on conflict (student_id, ref) do nothing;
    else
      insert into public.xp_events (student_id, trimester, source, ref, xp)
      select p.student_id, st.trimester, 'live_bonus', 'live_bonus:' || p_session_id, 25
        from public.live_players p join public.live_coin_players c on c.player_id = p.id
        join public.students st on st.id = p.student_id
       where p.session_id = p_session_id and c.cash > 0
       order by c.cash desc limit 3
      on conflict (student_id, ref) do nothing;
    end if;
  end if;
end $$;
revoke execute on function public._live_award_bonus(uuid) from public, anon, authenticated;
