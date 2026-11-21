-- Exit Survey class password, checked on the server so it isn't in the page source (2026-11-20).
-- Put the real password (lowercase) in place of __EXIT_PASS__ only in the copy you run. Never commit it.
create or replace function public.exit_survey_pass_ok(p_pass text)
returns boolean language sql stable security definer set search_path = public
as $$ select lower(btrim(coalesce(p_pass, ''))) = '__EXIT_PASS__' $$;
revoke all on function public.exit_survey_pass_ok(text) from public;
grant execute on function public.exit_survey_pass_ok(text) to anon, authenticated;

-- Sprite v2 helpers: fixed search_path (advisor lint 0011).
alter function public._pet_caps() set search_path = public;
alter function public._pet_habits() set search_path = public;
alter function public._pet_stage(integer, integer, boolean) set search_path = public;
