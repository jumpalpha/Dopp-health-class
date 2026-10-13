-- ============================================================
-- Partner Games: two students, two devices, one 4-letter code.
-- Games: 'connect4' (7 cols x 6 rows) and 'tictactoe' (3x3).
-- Same pattern as the rest of the site: table locked (RLS on, no policies);
-- the page only calls the SECURITY DEFINER functions below.
-- Each player holds a random secret token (kept in their tab); the table stores its hash.
-- A move is checked and the winner decided on the server, so nobody can fake a win.
-- Wins post to the class leaderboard only when BOTH players are signed-in students.
-- Safe to re-run.
-- ============================================================

create table if not exists public.duel_games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  game        text not null check (game in ('connect4','tictactoe')),
  board       text not null,
  turn        int  not null default 1 check (turn in (1,2)),
  starter     int  not null default 1 check (starter in (1,2)),
  status      text not null default 'waiting' check (status in ('waiting','playing','done')),
  winner      int,                         -- 0 draw, 1, 2
  reason      text,                        -- 'win','draw','left','timeout'
  last_move   int,
  moves       int  not null default 0,
  round       int  not null default 1,
  score1      int  not null default 0,
  score2      int  not null default 0,
  p1_name     text not null,
  p2_name     text,
  p1_tok      text not null,
  p2_tok      text,
  p1_student  uuid references public.students(id) on delete set null,
  p2_student  uuid references public.students(id) on delete set null,
  p1_seen     timestamptz not null default now(),
  p2_seen     timestamptz,
  rematch1    boolean not null default false,
  rematch2    boolean not null default false,
  recorded    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.duel_games enable row level security;
create unique index if not exists duel_games_open_code on public.duel_games (code) where status <> 'done';

insert into public.arcade_games (key, title, max_score, medals) values
  ('connect4_duel',  'Connect 4 (Partner)',   100000, '{100,500,1000,2000}'),
  ('tictactoe_duel', 'Tic-Tac-Toe (Partner)', 100000, '{100,500,1000,2000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

-- ---------- helpers (private) ----------
create or replace function public._duel_hash(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex');
$$;

-- 0 = nobody yet, 1 / 2 = that player has a line, 3 = board full (draw)
create or replace function public._duel_result(p_game text, b text) returns int
language plpgsql immutable as $$
declare
  cols int := case when p_game = 'connect4' then 7 else 3 end;
  rows int := case when p_game = 'connect4' then 6 else 3 end;
  need int := case when p_game = 'connect4' then 4 else 3 end;
  r int; c int; d int; k int; ch text; ok boolean;
  dr int[] := array[0,1,1,1]; dc int[] := array[1,0,1,-1];
begin
  for r in 0..rows-1 loop for c in 0..cols-1 loop
    ch := substr(b, r*cols + c + 1, 1);
    if ch = '0' then continue; end if;
    for d in 1..4 loop
      ok := true;
      for k in 1..need-1 loop
        if r + dr[d]*k < 0 or r + dr[d]*k >= rows or c + dc[d]*k < 0 or c + dc[d]*k >= cols
           or substr(b, (r + dr[d]*k)*cols + (c + dc[d]*k) + 1, 1) <> ch then ok := false; exit; end if;
      end loop;
      if ok then return ch::int; end if;
    end loop;
  end loop; end loop;
  if position('0' in b) = 0 then return 3; end if;
  return 0;
end $$;

-- posts a finished round to the leaderboard (both players must be signed-in students)
create or replace function public._duel_record(g public.duel_games) returns void
language plpgsql security definer set search_path = public as $$
declare t text; k text := g.game || '_duel'; s uuid; w boolean;
begin
  if g.p1_student is null or g.p2_student is null or g.p1_student = g.p2_student then return; end if;
  select trimester into t from public.site_term where id = 1;
  foreach s in array array[g.p1_student, g.p2_student] loop
    w := (g.winner = 1 and s = g.p1_student) or (g.winner = 2 and s = g.p2_student);
    insert into public.arcade_scores (student_id, trimester, game, best, wins, plays, updated_at)
    values (s, t, k, case when w then 100 else 0 end, case when w then 1 else 0 end, 1, now())
    on conflict (student_id, trimester, game) do update
      set wins = arcade_scores.wins + (case when w then 1 else 0 end),
          best = (arcade_scores.wins + (case when w then 1 else 0 end)) * 100,
          plays = arcade_scores.plays + 1, updated_at = now();
  end loop;
end $$;

create or replace function public._duel_finish(p_id uuid, p_winner int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.duel_games;
begin
  update public.duel_games set status = 'done', winner = p_winner, reason = p_reason, updated_at = now(),
         score1 = score1 + (case when p_winner = 1 then 1 else 0 end),
         score2 = score2 + (case when p_winner = 2 then 1 else 0 end)
   where id = p_id and status = 'playing' returning * into g;
  if found and not g.recorded then
    perform public._duel_record(g);
    update public.duel_games set recorded = true where id = p_id;
  end if;
end $$;

-- who is calling: 1, 2 or null
create or replace function public._duel_seat(g public.duel_games, p_token text) returns int
language sql stable as $$
  select case when g.p1_tok = public._duel_hash(p_token) then 1
              when g.p2_tok = public._duel_hash(p_token) then 2 end;
$$;

create or replace function public._duel_student(p_student_id uuid, p_pin_hash text) returns public.students
language sql stable security definer set search_path = public as $$
  select s.* from public.students s, public.site_term t
  where t.id = 1 and s.id = p_student_id and s.pin_hash = p_pin_hash and s.trimester = t.trimester;
$$;

create or replace function public._duel_view(g public.duel_games, me int) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', g.id, 'code', g.code, 'game', g.game, 'board', g.board, 'turn', g.turn, 'status', g.status,
    'winner', g.winner, 'reason', g.reason, 'last_move', g.last_move, 'moves', g.moves, 'round', g.round,
    'score1', g.score1, 'score2', g.score2, 'p1_name', g.p1_name, 'p2_name', g.p2_name, 'me', me,
    'ranked', g.p1_student is not null and g.p2_student is not null and g.p1_student <> g.p2_student,
    'rematch1', g.rematch1, 'rematch2', g.rematch2,
    'opp_online', case when me = 1 then g.p2_seen > now() - interval '15 seconds'
                       else g.p1_seen > now() - interval '15 seconds' end);
$$;

revoke all on function public._duel_hash(text) from public, anon, authenticated;
revoke all on function public._duel_record(public.duel_games) from public, anon, authenticated;
revoke all on function public._duel_finish(uuid, int, text) from public, anon, authenticated;
revoke all on function public._duel_student(uuid, text) from public, anon, authenticated;

-- ---------- public ----------
create or replace function public.duel_create(p_game text, p_token text, p_name text, p_student_id uuid default null, p_pin_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students; nm text; c text; g public.duel_games; tries int := 0;
begin
  if p_game not in ('connect4','tictactoe') then raise exception 'Unknown game'; end if;
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  -- tidy: open games nobody touched in 2 hours are closed
  update public.duel_games set status = 'done', reason = coalesce(reason, 'expired')
   where status <> 'done' and updated_at < now() - interval '2 hours';
  if p_student_id is not null then s := public._duel_student(p_student_id, p_pin_hash); end if;
  nm := left(btrim(coalesce(s.display_name, p_name, '')), 16);
  if nm = '' then raise exception 'Enter a name'; end if;
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '') from generate_series(1,4));
    begin
      insert into public.duel_games (code, game, board, p1_name, p1_tok, p1_student)
      values (c, p_game, repeat('0', case when p_game = 'connect4' then 42 else 9 end), nm, public._duel_hash(p_token), s.id)
      returning * into g;
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 20 then raise exception 'Try again'; end if;
    end;
  end loop;
  return public._duel_view(g, 1);
end $$;

create or replace function public.duel_join(p_code text, p_token text, p_name text, p_student_id uuid default null, p_pin_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students; nm text; g public.duel_games;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  select * into g from public.duel_games where code = upper(btrim(p_code)) and status <> 'done' for update;
  if not found then raise exception 'No open game with that code'; end if;
  if public._duel_seat(g, p_token) is not null then return public._duel_view(g, public._duel_seat(g, p_token)); end if;
  if g.status <> 'waiting' then raise exception 'That game already has two players'; end if;
  if p_student_id is not null then s := public._duel_student(p_student_id, p_pin_hash); end if;
  nm := left(btrim(coalesce(s.display_name, p_name, '')), 16);
  if nm = '' then raise exception 'Enter a name'; end if;
  update public.duel_games set p2_name = nm, p2_tok = public._duel_hash(p_token), p2_student = s.id,
         p2_seen = now(), status = 'playing', updated_at = now()
   where id = g.id returning * into g;
  return public._duel_view(g, 2);
end $$;

create or replace function public.duel_state(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int;
begin
  select * into g from public.duel_games where id = p_id;
  if not found then raise exception 'Game not found'; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if me = 1 then update public.duel_games set p1_seen = now() where id = p_id;
  else update public.duel_games set p2_seen = now() where id = p_id; end if;
  -- opponent gone for a minute during play: you win
  if g.status = 'playing' and ((me = 1 and g.p2_seen < now() - interval '60 seconds') or (me = 2 and g.p1_seen < now() - interval '60 seconds')) then
    perform public._duel_finish(p_id, me, 'timeout');
  end if;
  select * into g from public.duel_games where id = p_id;
  return public._duel_view(g, me);
end $$;

create or replace function public.duel_move(p_id uuid, p_token text, p_cell int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int; idx int; r int; res int; b text;
begin
  select * into g from public.duel_games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status <> 'playing' then raise exception 'Game is not in play'; end if;
  if g.turn <> me then raise exception 'Not your turn'; end if;
  if g.game = 'connect4' then   -- p_cell is the column; the piece drops to the lowest open spot
    if p_cell < 0 or p_cell > 6 then raise exception 'Bad column'; end if;
    idx := null;
    for r in reverse 5..0 loop if substr(g.board, r*7 + p_cell + 1, 1) = '0' then idx := r*7 + p_cell; exit; end if; end loop;
    if idx is null then raise exception 'Column is full'; end if;
  else
    if p_cell < 0 or p_cell > 8 or substr(g.board, p_cell + 1, 1) <> '0' then raise exception 'Square taken'; end if;
    idx := p_cell;
  end if;
  b := overlay(g.board placing me::text from idx + 1 for 1);
  update public.duel_games set board = b, last_move = idx, moves = moves + 1, turn = 3 - me, updated_at = now(),
         p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
   where id = p_id;
  res := public._duel_result(g.game, b);
  if res in (1,2) then perform public._duel_finish(p_id, res, 'win');
  elsif res = 3 then perform public._duel_finish(p_id, 0, 'draw'); end if;
  select * into g from public.duel_games where id = p_id;
  return public._duel_view(g, me);
end $$;

create or replace function public.duel_leave(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int;
begin
  select * into g from public.duel_games where id = p_id;
  if not found then return null; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status = 'playing' then perform public._duel_finish(p_id, 3 - me, 'left');
  elsif g.status = 'waiting' then update public.duel_games set status = 'done', reason = 'left', updated_at = now() where id = p_id; end if;
  select * into g from public.duel_games where id = p_id;
  return public._duel_view(g, me);
end $$;

-- both press Rematch: fresh board, the other player goes first, series score kept
create or replace function public.duel_rematch(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int;
begin
  select * into g from public.duel_games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status <> 'done' or g.reason in ('left','expired') then raise exception 'Rematch not available'; end if;
  if me = 1 then update public.duel_games set rematch1 = true where id = p_id returning * into g;
  else update public.duel_games set rematch2 = true where id = p_id returning * into g; end if;
  if g.rematch1 and g.rematch2 then
    update public.duel_games set board = repeat('0', length(board)), status = 'playing', winner = null, reason = null,
           last_move = null, moves = 0, round = round + 1, starter = 3 - starter, turn = 3 - starter,
           rematch1 = false, rematch2 = false, recorded = false, updated_at = now(), p1_seen = now(), p2_seen = now()
     where id = p_id returning * into g;
  end if;
  return public._duel_view(g, me);
end $$;

revoke all on function public.duel_create(text, text, text, uuid, text) from public;
revoke all on function public.duel_join(text, text, text, uuid, text) from public;
revoke all on function public.duel_state(uuid, text) from public;
revoke all on function public.duel_move(uuid, text, int) from public;
revoke all on function public.duel_leave(uuid, text) from public;
revoke all on function public.duel_rematch(uuid, text) from public;
grant execute on function public.duel_create(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.duel_join(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.duel_state(uuid, text) to anon, authenticated;
grant execute on function public.duel_move(uuid, text, int) to anon, authenticated;
grant execute on function public.duel_leave(uuid, text) to anon, authenticated;
grant execute on function public.duel_rematch(uuid, text) to anon, authenticated;

-- 2026-10-13: added 'memory' (Dopp Memory). Applied as migration "partner_memory_game":
-- new columns secret / flip1 / peek / peek_until, _duel_memory_deck(), and memory branches in
-- _duel_view, duel_create, duel_move and duel_rematch. The card layout (secret) is never sent
-- to the page; only flipped or matched cards are.
