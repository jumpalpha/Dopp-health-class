-- Register Immune Defense for the class arcade leaderboard. Safe to re-run.
insert into public.arcade_games (key, title, max_score, medals) values
  ('immune_defense', 'Immune Defense', 6000, '{600,1500,2500,3000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;
