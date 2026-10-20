-- ============================================================
-- Partner Games: Dots and Boxes. Applied as migration "partner_dots_game".
-- Builds on duel_games.sql + the memory and battleship migrations.
--
-- 6x6 dots = 5x5 boxes. board (85 chars):
--   0-29   lines across: row r (0-5), col c (0-4) -> r*5 + c
--   30-59  lines down:   row r (0-4), col c (0-5) -> 30 + r*6 + c
--   60-84  boxes: row r, col c -> 60 + r*5 + c   ('0' open, '1'/'2' owner)
-- Lines store who drew them. Close a box: it's yours and you go again.
-- 25 boxes, so there is never a tie. Rematch needs no change (board resets by length).
-- Safe to re-run.
-- ============================================================

alter table public.duel_games drop constraint if exists duel_games_game_check;
alter table public.duel_games add constraint duel_games_game_check check (game in ('connect4','tictactoe','memory','battleship','dots'));

insert into public.arcade_games (key, title, max_score, medals) values
  ('dots_duel', 'Dots and Boxes (Partner)', 100000, '{100,500,1000,2000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;

create or replace function public.duel_create(p_game text, p_token text, p_name text, p_student_id uuid default null, p_pin_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students; nm text; c text; g public.duel_games; tries int := 0;
begin
  if p_game not in ('connect4','tictactoe','memory','battleship','dots') then raise exception 'Unknown game'; end if;
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
      values (c, p_game, repeat('0', case p_game when 'connect4' then 42 when 'memory' then 16 when 'battleship' then 128 when 'dots' then 85 else 9 end),
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
        shots_at int; fleet_at int; ship text; i int; sunk boolean; hits int; cc int; got int;
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

  if g.game = 'dots' then
    -- 6x6 dots, 5x5 boxes. board: 60 lines (0-29 across, 30-59 down) then 25 box owners.
    if p_cell < 0 or p_cell > 59 or substr(g.board, p_cell + 1, 1) <> '0' then raise exception 'That line is already drawn'; end if;
    b := overlay(g.board placing me::text from p_cell + 1 for 1);
    got := 0;
    for r in 0..4 loop for cc in 0..4 loop
      if substr(b, 61 + r*5 + cc, 1) = '0'
         and substr(b, r*5 + cc + 1, 1) <> '0' and substr(b, (r+1)*5 + cc + 1, 1) <> '0'
         and substr(b, 31 + r*6 + cc, 1) <> '0' and substr(b, 32 + r*6 + cc, 1) <> '0' then
        b := overlay(b placing me::text from 61 + r*5 + cc for 1); got := got + 1;
      end if;
    end loop; end loop;
    -- finishing a box earns another turn
    update public.duel_games set board = b, last_move = p_cell, moves = moves + 1, turn = case when got > 0 then me else 3 - me end, updated_at = now(),
           p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
     where id = p_id;
    if position('0' in substr(b, 61, 25)) = 0 then
      n1 := 25 - length(replace(substr(b, 61, 25), '1', '')); n2 := 25 - n1;
      perform public._duel_finish(p_id, case when n1 > n2 then 1 else 2 end, 'win');
    end if;
    select * into g from public.duel_games where id = p_id;
    return public._duel_view(g, me);
  end if;

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
