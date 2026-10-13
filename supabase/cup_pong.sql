-- Register Cup Pong for the class arcade leaderboard. Safe to re-run.
insert into public.arcade_games (key, title, max_score, medals) values
  ('cup_pong', 'Cup Pong', 15000, '{500,1200,2000,3200}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;
