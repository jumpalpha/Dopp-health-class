-- Register Sprite Siege for the class arcade leaderboard. Safe to re-run.
insert into public.arcade_games (key, title, max_score, medals) values
  ('sprite_siege', 'Sprite Siege', 30000, '{600,1200,2000,3000}')
on conflict (key) do update set title = excluded.title, max_score = excluded.max_score, medals = excluded.medals;
