-- Sprite: raise the daily "chapter question" snack limit from 10 to 15 (Oct 2026).
-- Arcade games now ask a vocab question every few rounds; a right answer feeds the sprite
-- and shares this daily limit with the Sprite page. Safe to re-run.
-- Rewrites only the number inside the two live functions; everything else stays exactly as is.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.pet_action(uuid,text,text,text)'::regprocedure);
  if position('"quiz":10' in d) > 0 then execute replace(d, '"quiz":10', '"quiz":15'); end if;
  d := pg_get_functiondef('public._pet_view(public.student_pets,boolean)'::regprocedure);
  if position('"quiz":10' in d) > 0 then execute replace(d, '"quiz":10', '"quiz":15'); end if;
end $$;
