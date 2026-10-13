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

-- 2026-10-13 (later): old self-marked days hidden, not deleted.
-- active_days_backup_20261013 holds them; _real_day() filters them out of
-- get_student_days(uuid,text) and get_leaderboard_data(text) for dates before 2026-10-13.
-- To bring them back: make _real_day() return true.
revoke execute on function public.get_student_days(uuid) from public, anon, authenticated;
revoke execute on function public.reset_student_progress(uuid) from public, anon, authenticated;
