-- ============================================================
-- Demo account seed: creates "Pilot" (class TEST) with MADE-UP
-- progress for about 65% of the trimester checklist.
-- Nothing is copied from any real student (2026-11-10 lock-down).
--   Chapters 1-11: every section read, every vocab game, mastery passed
--   Chapter 12: half read; homework 1-10 and Tests 1-3 checked
--   Realms 1-3 quests + part of Realm 4, a few arcade games,
--   a short trail streak and a cared-for sprite.
-- To tune the %, change v_done (chapters fully done) and re-run.
-- The password is 4 digits + a 4-letter word (8 characters, not a 4-digit PIN).
-- Put it in place of __DEMO_PIN__ ONLY in the copy you run. Never commit it.
-- Run after demo_account.sql and permanent_students.sql. Safe to re-run (it rebuilds Pilot).
-- ============================================================
set local app.demo_admin = 'on';

do $$
declare
  tri constant text := '2026-T1';
  v_done constant int := 11;                       -- chapters fully done
  t0 constant date := date '2026-09-03';           -- first class day
  jid uuid; c int; d date; i int;
  sec int[] := array[4,4,3,4,4,4,3,3,4,4,4,4,4,4,4,4];   -- sections per chapter 1-16
  vmodes text[] := array['flashcard','wordbuild','speedquiz','conceptmap'];
  games text[] := array['sprite_flap','sprite_run','vocab_slice','habit_showdown','germ_sweeper','blast_blocks','sprite_dash','how_smart'];
  v_hash text := encode(extensions.digest('__DEMO_PIN__' || 'https://gmeyamrlqfrabtslsweu.supabase.co', 'sha256'), 'hex');
begin
  perform set_config('app.demo_admin', 'on', true);   -- the demo guards would otherwise drop these writes
  select id into jid from public.students where is_demo and class_code = 'TEST' and lower(last_name) = 'demo';
  if jid is not null then
    delete from public.checklist_events where student_id = jid;
    delete from public.checklist_manual where student_id = jid;
    delete from public.checklist_verify where student_id = jid;
    delete from public.mastery_attempts where student_id = jid;
    delete from public.arcade_scores where student_id = jid;
    delete from public.trail_daily where student_id = jid;
    delete from public.trail_runs where student_id = jid;
    delete from public.student_pets where student_id = jid;
    delete from public.pet_care_days where student_id = jid;
    delete from public.xp_events where student_id = jid;
    delete from public.quest_progress where student_id = jid;
    delete from public.active_days where student_id = jid;
    delete from public.weight_control_quest_progress where student_id = jid;
    delete from public.student_project_data where student_id = jid;
    update public.students set display_name = 'Pilot', trimester = tri, class_code = 'TEST', pin_hash = v_hash where id = jid;
  else
    insert into public.students (class_code, last_name, display_name, pin_hash, avatar, trimester, is_demo)
    values ('TEST', 'Demo', 'Pilot', v_hash, '🛡', tri, true)
    returning id into jid;
  end if;
  update public.students set permanent = true where id = jid;   -- never expires (permanent_students.sql)

  -- one chapter about every 6 days
  for c in 1..(v_done + 1) loop
    d := t0 + (c - 1) * 6;
    for i in 1..(case when c <= v_done then sec[c] else 2 end) loop
      insert into public.checklist_events (student_id, trimester, kind, chapter, item, n, meta, first_at, last_at)
      values (jid, tri, 'read', c, 's' || i, 1, jsonb_build_object('of', sec[c], 'sec', 70 + i * 9),
              (d + time '10:05') + make_interval(mins => i * 4), (d + time '10:05') + make_interval(mins => i * 4));
    end loop;
    continue when c > v_done;
    if c <> 4 then   -- chapter 4 has no vocab games
      for i in 1..4 loop
        insert into public.checklist_events (student_id, trimester, kind, chapter, item, n, meta, first_at, last_at)
        values (jid, tri, 'vocab', c, vmodes[i], 1 + (c + i) % 3,
                jsonb_build_object('pct', 80 + (c * 7 + i * 3) % 18, 'total', 20, 'correct', 16 + (c + i) % 4, 'answered', 20,
                                   'best_pct', 80 + (c * 7 + i * 3) % 18, 'first_pct', 70 + (c * 5 + i) % 15),
                (d + 1 + time '10:20') + make_interval(mins => i * 6), (d + 2 + time '10:20') + make_interval(mins => i * 6));
      end loop;
    end if;
    insert into public.mastery_attempts (student_id, trimester, chapter, questions, current, correct, started_at, finished_at, passed)
    values (jid, tri, c, '[]'::jsonb, 10, 8 + c % 3, d + 3 + time '10:30', d + 3 + time '10:38', true);
    insert into public.xp_events (student_id, trimester, source, ref, xp, created_at)
    values (jid, tri, 'mastery', 'mastery:ch' || c, 50, d + 3 + time '10:38');
    if c <= 10 then
      insert into public.checklist_manual (student_id, trimester, key, checked, updated_at)
      values (jid, tri, 'hw:ch' || c, true, d + 4 + time '15:00');
    end if;
  end loop;
  -- one missed try on the next chapter's mastery quiz (real students miss sometimes)
  insert into public.mastery_attempts (student_id, trimester, chapter, questions, current, correct, started_at, finished_at, passed)
  values (jid, tri, v_done + 1, '[]'::jsonb, 10, 6, t0 + v_done * 6 + 3 + time '10:30', t0 + v_done * 6 + 3 + time '10:39', false);
  insert into public.checklist_manual (student_id, trimester, key, checked, updated_at)
  select jid, tri, 'test:' || x, true, t0 + n * 14 + time '14:00'
    from (values ('t1', 1), ('t2', 2), ('t3', 3)) v(x, n);

  -- quests: realms 1-3 and the first part of realm 4
  insert into public.quest_progress (student_id, task_key, completed_at)
  select jid, k, t0 + (n / 2)::int + time '11:00'
    from unnest(array['r1_0','r1_1','r1_2','r1_3','r1_4','r1_5','r1_6','r1_7',
                      'r2_0','r2_1','r2_2','r2_3','r2_4','r2_5','r2_6','r2_7','r2_8','r2_9',
                      'r3_0','r3_1','r3_2','r3_3','r3_4','r3_5','r3_6','r3_7','r3_8','r3_9','r3_10','r3_11',
                      'r4_0','r4_1','r4_2','r4_3','r4_4','r4_5']) with ordinality u(k, n);

  -- logins on most school days so far
  insert into public.active_days (student_id, day_date)
  select jid, g::date from generate_series(t0::timestamp, timestamp '2026-11-07', interval '1 day') g
   where extract(isodow from g) < 6 and (extract(doy from g)::int % 7) <> 3;

  -- arcade
  for i in 1..array_length(games, 1) loop
    insert into public.arcade_scores (student_id, trimester, game, best, wins, plays, updated_at)
    values (jid, tri, games[i], 120 + i * 37, i % 3, 2 + i, t0 + 10 + i * 5 + time '12:10');
    insert into public.xp_events (student_id, trimester, source, ref, xp, created_at)
    values (jid, tri, 'arcade', 'arcade:' || games[i], 10, t0 + 10 + i * 5 + time '12:10');
  end loop;

  -- wellness trail: 5 days since it opened
  for i in 0..4 loop
    d := date '2026-10-16' + i * 5;
    insert into public.trail_daily (student_id, day, miles) values (jid, d, 3);
    insert into public.xp_events (student_id, trimester, source, ref, xp, created_at)
    values (jid, tri, 'trail', 'trail:day:' || d, 5, d + time '12:30');
  end loop;
  insert into public.trail_runs (student_id, trimester, run_no, status, miles, state, score, started_at, updated_at)
  values (jid, tri, 1, 'active', 15, '{}'::jsonb, 0, date '2026-10-16' + time '12:30', date '2026-11-05' + time '12:30');

  -- the sprite (immortal, so the demo never shows a dead one)
  insert into public.student_pets (student_id, trimester, name, color, born_at, care_points, streak, best_streak,
                                   streak_date, day_date, last_tick, updated_at, immortal)
  values (jid, tri, 'Sparky',
          coalesce((select p.color from public.student_pets p group by p.color order by count(*) desc limit 1), 'blue'),
          t0 + 7 + time '11:00', 240, 6, 15, current_date, current_date, now(), now(), true);
  insert into public.pet_care_days (student_id, trimester, day, habits, quiz, backfill)
  select jid, tri, g::date, 3, 1, false from generate_series((t0 + 7)::timestamp, timestamp '2026-11-07', interval '1 day') g
   where extract(isodow from g) < 6 and (extract(doy from g)::int % 4) <> 1;
end $$;
