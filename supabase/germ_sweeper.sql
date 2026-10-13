-- Register Germ Sweeper for the class arcade leaderboard. Safe to re-run.
insert into public.arcade_games (key, title, max_score, medals) values
  ('germ_sweeper', 'Germ Sweeper', 3000, '{500,1000,1600,2000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;
