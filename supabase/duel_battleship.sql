-- ============================================================
-- Partner Games: Battleship. Applied as migration "partner_battleship_game".
-- Builds on duel_games.sql (+ the 'memory' migration: secret / flip1 / peek / peek_until).
--
-- 8x8 grid, fleet of 5 ships: 4, 3, 3, 2, 2 (14 squares). Ships never touch.
--   secret (128 chars): player 1's fleet (64) then player 2's fleet (64). '0' water, '1'-'5' ship id.
--   board  (128 chars): player 1's shots at player 2 (64) then player 2's shots at player 1 (64).
--                       '0' not fired, 'm' miss, 'h' hit, 's' sunk.
-- Setup: both players see only their own fleet, can Shuffle, then press Ready.
-- Firing starts when both are ready; players alternate one shot at a time.
-- The other player's fleet is never sent to the page until the round is over.
-- Safe to re-run.
-- ============================================================

alter table public.duel_games add column if not exists ready1 boolean not null default false;
alter table public.duel_games add column if not exists ready2 boolean not null default false;
alter table public.duel_games drop constraint if exists duel_games_game_check;
alter table public.duel_games add constraint duel_games_game_check check (game in ('connect4','tictactoe','memory','battleship'));

insert into public.arcade_games (key, title, max_score, medals) values
  ('battleship_duel', 'Battleship (Partner)', 100000, '{100,500,1000,2000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

-- one random 64-square fleet; ships never overlap or touch (not even corners)
create or replace function public._duel_bs_fleet() returns text
language plpgsql volatile as $$
declare
  lens int[] := array[4,3,3,2,2];
  g text; ship int; tries int; ok boolean; horiz boolean; r int; c int; k int; rr int; cc int; dr int; dc int;
begin
  <<whole>> loop
    g := repeat('0', 64);
    for ship in 1..5 loop
      tries := 0; ok := false;
      while not ok and tries < 200 loop
        tries := tries + 1;
        horiz := random() < 0.5;
        r := floor(random() * (case when horiz then 8 else 9 - lens[ship] end))::int;
        c := floor(random() * (case when horiz then 9 - lens[ship] else 8 end))::int;
        ok := true;
        for k in 0..lens[ship]-1 loop
          for dr in -1..1 loop for dc in -1..1 loop
            rr := r + (case when horiz then 0 else k end) + dr;
            cc := c + (case when horiz then k else 0 end) + dc;
            if rr between 0 and 7 and cc between 0 and 7 and substr(g, rr*8 + cc + 1, 1) <> '0' then ok := false; end if;
          end loop; end loop;
        end loop;
      end loop;
      if not ok then continue whole; end if;   -- boxed in: start the whole fleet over
      for k in 0..lens[ship]-1 loop
        rr := r + (case when horiz then 0 else k end); cc := c + (case when horiz then k else 0 end);
        g := overlay(g placing ship::text from rr*8 + cc + 1 for 1);
      end loop;
    end loop;
    return g;
  end loop;
end $$;
revoke all on function public._duel_bs_fleet() from public, anon, authenticated;

-- what each player is allowed to see
create or replace function public._duel_view(g public.duel_games, me int) returns jsonb
language plpgsql stable as $$
declare faces jsonb := '{}'::jsonb; i int; p text; extra jsonb := '{}'::jsonb;
begin
  if g.game = 'memory' and g.secret is not null then
    for i in 0..15 loop
      if substr(g.board, i + 1, 1) <> '0' or g.flip1 = i or g.status = 'done' then faces := faces || jsonb_build_object(i::text, substr(g.secret, i + 1, 1)); end if;
    end loop;
    if g.peek is not null and g.peek_until > now() then
      foreach p in array string_to_array(g.peek, ',') loop faces := faces || jsonb_build_object(p, substr(g.secret, p::int + 1, 1)); end loop;
    end if;
  end if;
  if g.game = 'battleship' and g.secret is not null then
    extra := jsonb_build_object(
      'ready1', g.ready1, 'ready2', g.ready2,
      'my_fleet', substr(g.secret, case when me = 1 then 1 else 65 end, 64),
      -- the other fleet only once the round is over
      'opp_fleet', case when g.status = 'done' then substr(g.secret, case when me = 1 then 65 else 1 end, 64) end);
  end if;
  return jsonb_build_object(
    'id', g.id, 'code', g.code, 'game', g.game, 'board', g.board, 'turn', g.turn, 'status', g.status,
    'winner', g.winner, 'reason', g.reason, 'last_move', g.last_move, 'moves', g.moves, 'round', g.round,
    'score1', g.score1, 'score2', g.score2, 'p1_name', g.p1_name, 'p2_name', g.p2_name, 'me', me,
    'ranked', g.p1_student is not null and g.p2_student is not null and g.p1_student <> g.p2_student,
    'rematch1', g.rematch1, 'rematch2', g.rematch2, 'faces', faces, 'flip1', g.flip1,
    'peek', case when g.peek_until > now() then g.peek end,
    'peek_ms', case when g.peek_until > now() then (extract(epoch from g.peek_until - now()) * 1000)::int else 0 end,
    'opp_online', case when me = 1 then g.p2_seen > now() - interval '15 seconds'
                       else g.p1_seen > now() - interval '15 seconds' end) || extra;
end $$;

create or replace function public.duel_create(p_game text, p_token text, p_name text, p_student_id uuid default null, p_pin_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students; nm text; c text; g public.duel_games; tries int := 0;
begin
  if p_game not in ('connect4','tictactoe','memory','battleship') then raise exception 'Unknown game'; end if;
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  update public.duel_games set status = 'done', reason = coalesce(reason, 'expired')
   where status <> 'done' and updated_at < now() - interval '2 hours';
  if p_student_id is not null then s := public._duel_student(p_student_id, p_pin_hash); end if;
  nm := left(btrim(coalesce(s.display_name, p_name, '')), 16);
  if nm = '' then raise exception 'Enter a name'; end if;
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '') from generate_series(1,4));
    begin
      insert into public.duel_games (code, game, board, secret, p1_name, p1_tok, p1_student)
      values (c, p_game, repeat('0', case p_game when 'connect4' then 42 when 'memory' then 16 when 'battleship' then 128 else 9 end),
              case p_game when 'memory' then public._duel_memory_deck()
                          when 'battleship' then public._duel_bs_fleet() || public._duel_bs_fleet() end,
              nm, public._duel_hash(p_token), s.id)
      returning * into g;
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 20 then raise exception 'Try again'; end if;
    end;
  end loop;
  return public._duel_view(g, 1);
end $$;

create or replace function public.duel_move(p_id uuid, p_token text, p_cell int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int; idx int; r int; res int; b text; n1 int; n2 int;
        shots_at int; fleet_at int; ship text; i int; sunk boolean; hits int;
begin
  select * into g from public.duel_games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status <> 'playing' then raise exception 'Game is not in play'; end if;

  if g.game = 'battleship' then
    if not (g.ready1 and g.ready2) then raise exception 'Waiting for both players to be ready'; end if;
    if g.turn <> me then raise exception 'Not your turn'; end if;
    if p_cell < 0 or p_cell > 63 then raise exception 'Bad square'; end if;
    shots_at := case when me = 1 then 0 else 64 end;    -- my shots in the board
    fleet_at := case when me = 1 then 64 else 0 end;    -- the fleet I am shooting at
    if substr(g.board, shots_at + p_cell + 1, 1) <> '0' then raise exception 'You already fired there'; end if;
    ship := substr(g.secret, fleet_at + p_cell + 1, 1);
    if ship = '0' then
      b := overlay(g.board placing 'm' from shots_at + p_cell + 1 for 1);
    else
      b := overlay(g.board placing 'h' from shots_at + p_cell + 1 for 1);
      sunk := true;
      for i in 0..63 loop
        if substr(g.secret, fleet_at + i + 1, 1) = ship and substr(b, shots_at + i + 1, 1) = '0' then sunk := false; end if;
      end loop;
      if sunk then
        for i in 0..63 loop
          if substr(g.secret, fleet_at + i + 1, 1) = ship then b := overlay(b placing 's' from shots_at + i + 1 for 1); end if;
        end loop;
      end if;
    end if;
    update public.duel_games set board = b, last_move = shots_at + p_cell, moves = moves + 1, turn = 3 - me, updated_at = now(),
           p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
     where id = p_id;
    hits := 64 - length(replace(replace(substr(b, shots_at + 1, 64), 'h', ''), 's', ''));
    if hits >= 14 then perform public._duel_finish(p_id, me, 'win'); end if;
    select * into g from public.duel_games where id = p_id;
    return public._duel_view(g, me);
  end if;

  if g.turn <> me then raise exception 'Not your turn'; end if;

  if g.game = 'memory' then
    if g.peek_until > now() then raise exception 'Wait for the cards to flip back'; end if;
    if p_cell < 0 or p_cell > 15 or substr(g.board, p_cell + 1, 1) <> '0' or g.flip1 = p_cell then raise exception 'Pick a face-down card'; end if;
    if g.flip1 is null then
      update public.duel_games set flip1 = p_cell, last_move = p_cell, peek = null, peek_until = null, updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_id;
    elsif substr(g.secret, g.flip1 + 1, 1) = substr(g.secret, p_cell + 1, 1) then
      -- a match: both cards are yours, and you go again
      b := overlay(overlay(g.board placing me::text from g.flip1 + 1 for 1) placing me::text from p_cell + 1 for 1);
      update public.duel_games set board = b, flip1 = null, last_move = p_cell, moves = moves + 1, peek = null, peek_until = null, updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_id;
      if position('0' in b) = 0 then
        n1 := length(b) - length(replace(b, '1', '')); n2 := length(b) - length(replace(b, '2', ''));
        perform public._duel_finish(p_id, case when n1 > n2 then 1 when n2 > n1 then 2 else 0 end, case when n1 = n2 then 'draw' else 'win' end);
      end if;
    else
      -- a miss: show both for a moment, then it's the other player's turn
      update public.duel_games set flip1 = null, last_move = p_cell, moves = moves + 1, turn = 3 - me,
             peek = g.flip1 || ',' || p_cell, peek_until = now() + interval '1.6 seconds', updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_id;
    end if;
    select * into g from public.duel_games where id = p_id;
    return public._duel_view(g, me);
  end if;

  if g.game = 'connect4' then
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

-- Battleship setup: 'shuffle' my fleet (before I'm ready) or say I'm 'ready'
create or replace function public.duel_setup(p_id uuid, p_token text, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.duel_games; me int;
begin
  select * into g from public.duel_games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  me := public._duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.game <> 'battleship' then raise exception 'Not a Battleship game'; end if;
  if g.status = 'done' then raise exception 'Game is over'; end if;
  if (me = 1 and g.ready1) or (me = 2 and g.ready2) then return public._duel_view(g, me); end if;
  if p_action = 'shuffle' then
    update public.duel_games set
           secret = case when me = 1 then public._duel_bs_fleet() || substr(secret, 65, 64)
                         else substr(secret, 1, 64) || public._duel_bs_fleet() end,
           updated_at = now()
     where id = p_id returning * into g;
  elsif p_action = 'ready' then
    update public.duel_games set ready1 = ready1 or me = 1, ready2 = ready2 or me = 2, updated_at = now()
     where id = p_id returning * into g;
  else raise exception 'Unknown action'; end if;
  return public._duel_view(g, me);
end $$;

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
           secret = case game when 'memory' then public._duel_memory_deck()
                              when 'battleship' then public._duel_bs_fleet() || public._duel_bs_fleet() end,
           flip1 = null, peek = null, peek_until = null, ready1 = false, ready2 = false,
           rematch1 = false, rematch2 = false, recorded = false, updated_at = now(), p1_seen = now(), p2_seen = now()
     where id = p_id returning * into g;
  end if;
  return public._duel_view(g, me);
end $$;

revoke all on function public.duel_setup(uuid, text, text) from public;
grant execute on function public.duel_setup(uuid, text, text) to anon, authenticated;
