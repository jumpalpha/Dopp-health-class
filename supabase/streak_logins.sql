-- Activity Streak = real logins only. Applied 2026-10-13.
-- * verify_student_pin(): a correct PIN logs today's date (Mountain time) in active_days.
-- * create_student_profile(): making an account counts as that day's login.
-- * complete_day / remove_day: students can no longer mark or unmark days themselves
--   (the old no-PIN versions let anyone change anyone's days).
-- See the live function definitions in Supabase for the full bodies.
revoke execute on function public.complete_day(uuid, text, date) from public, anon, authenticated;
revoke execute on function public.remove_day(uuid, text, date) from public, anon, authenticated;
revoke execute on function public.complete_day(uuid, date) from public, anon, authenticated;
revoke execute on function public.remove_day(uuid, date) from public, anon, authenticated;
