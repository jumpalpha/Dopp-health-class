# Handoff: Demo account "Pilot" + never-expiring accounts

## UPDATE 2026-11-10 (evening): applied and locked down
- Renamed Jason -> **Pilot**. Password = 4 digits + a 4-letter word (Alan has it; never commit it). quest.html accepts
  that format for any 8-char digits+letters entry (lower-cased); real students still use 4-digit PINs.
- Teacher view in the demo is limited to roster / checklist / briefing / sprite / trail / term screens (numbers, dates,
  masked names). Ask Mr. Dopp, Cost of Your Future, Weight Control Quest, name requests, sprite admin, duplicates,
  visitors and roster-changing tools are refused.
- Pilot's progress is **made up** (demo_seed.sql); nothing is copied from a real student.
- Fixed a bug in demo_call: proargtypes::oid[] is 0-based, so every argument type was off by one.
- All three SQL files are APPLIED on the live database. SQL checks passed: writes as Pilot dropped, roster masked,
  live_teacher_key unchanged, refused tools refused, wrong password refused, briefing "save" rolled back.

---


Branch: `demo-account` (NOT merged to `main`, nothing is live yet).
Supabase project: `dopp-health-class` (ref `gmeyamrlqfrabtslsweu`).

## What Orion asked for
1. A demo account: **Pilot**, class code **TEST**, PIN chosen by Orion (ask him; not stored in the repo). It shows real site data but **can't change anything**, it looks like a teacher account on the teacher side, and it starts a **guided tour** on every sign-in.
2. Pilot should be about **65%** through the trimester checklist.
3. **Pilot and Orion's own TEST account (display name `Alsmypal`) never expire** as students. They carry into each new trimester and their device logins never time out.

His decisions (already answered):
- Teacher view shows **real data with names masked** ("Student 12 #12").
- Pilot is **hidden everywhere public** (Hall of Heroes, Sprite Gallery, leaderboards).
- Student side: **works, but nothing saves**.
- Tour: **starts every login, plus a 🧭 Tour replay button**.
- He said "Approve database changes". The apply attempt timed out waiting on the Supabase approval prompt, so **no SQL has been applied yet**.

## Status
| Piece | State |
|---|---|
| `supabase/demo_account.sql` | written, **not applied** |
| `supabase/permanent_students.sql` | written, **not applied** |
| `supabase/demo_seed.sql` | written, **not applied** |
| Front-end (local-guard.js, demo_tour.js, quest.html, teacher.html, theme.js, term.js, welcome.html) | written + syntax-checked, **not pushed to main** |
| Browser testing | **not done** |

## Next steps (in order)
1. In `demo_seed.sql`, replace `__DEMO_PIN__` with the PIN Orion chose **in the copy you run only — never commit it**. Apply the SQL in this order: `demo_account.sql`, then `permanent_students.sql`, then `demo_seed.sql`. Use the Supabase MCP `apply_migration` (Orion approves the prompt) or paste the files into the SQL Editor.
2. Sanity checks in SQL:
   - `select id, display_name, is_demo, permanent from students where class_code='TEST';` should show Pilot with is_demo and permanent both true, and Alsmypal with permanent true.
   - Simulate a write as Pilot: call `cl_log(...)` with Pilot's id and PIN hash. No row should appear in `checklist_events`, because the backstop trigger drops it.
   - `select demo_call(<jason id>, <pin hash>, 'cl_teacher_roster', '{"p_teacher_pass":"demo","p_trimester":"2026-T1"}');` should return masked names. Then confirm `live_teacher_key` is unchanged.
   - `demo_call(..., 'pin_reset_search', ...)` should error with "turned off in the demo".
3. Merge `demo-account` into `main` and push (GitHub Pages deploys).
4. Browser test on doppsclass.com:
   - Sign in with class TEST, pick Pilot, enter his PIN. The page reloads into demo mode with a "DEMO · nothing is saved" badge and the tour starts.
   - Walk all 22 tour steps (`demo_tour.js` STEPS). Fix any `sel` selectors that don't highlight.
   - Check the checklist % is about 65%. If not, re-run `demo_seed.sql` with a different `src` student (candidate list is in the chat history; this was ranked by reads + vocab + mastery).
   - Teacher dashboard: names masked, "Save" actions show a toast and nothing persists.
   - Sign out, then sign in as a normal student: no demo mode, and `teacher.html` asks for the passphrase.
   - Hall of Heroes and Sprite Gallery should not show Pilot.
5. Run `python3 tools/build_pwa.py` only if new pages were added (none were).

## How it works (design)
- **All safety is server-side.** The repo is public, so nothing client-side is trusted.
- `students.is_demo`: only settable with `set local app.demo_admin='on'`. Triggers block flipping it on, and block updating or deleting a demo row.
- `demo_call(sid, pin, fn, args)` (security definer):
  - verifies a demo student, finds the matching anon-executable public function, and runs it inside a plpgsql sub-block;
  - then raises `DEMO1`, so **every write is rolled back** while the result is kept;
  - teacher functions get a throwaway key: `live_teacher_key` is UPDATEd inside the rolled-back block, so the real passphrase is never used or exposed;
  - teacher functions are allowlisted (`teacher_ok`); PIN reset, sub codes, host_*, start_new_trimester, create_live_session and reset_student_progress are refused;
  - output goes through `_demo_mask()`: exact-match name strings and capitalised name words in free text are replaced, and pin/pass hashes are blanked.
- Backstop: `_demo_block_write` triggers on every table with student-id columns silently drop writes for demo students. This covers someone calling the normal RPCs directly with Pilot's PIN.
- `pet_gallery`, `pet_fallen` and `get_leaderboard_data` exclude `is_demo`. Arcade and trail boards already exclude the TEST class.
- Client: `local-guard.js` (first script on 124 classic pages) checks the `dopp_demo` flag (set by `quest.html` `demoCheck()` after login via `demo_is`). It wraps `window.fetch` so every `/rest/v1/rpc/*` call goes to `demo_call`, fakes table writes, and injects `/demo_tour.js`. `theme.js` loads local-guard on the Next.js pages.
- `teacher.html`: in demo mode `teacher_pass='demo'` (meaningless outside demo_call), and the lock button returns to quest.html.
- Permanent accounts: `students.permanent`. `start_new_trimester` calls `_carry_permanent()` before turning everyone else into visitors. It moves their rows plus the TEST class code into the new trimester. `term.js` DoppRemember stores `perm:true` for TEST-class logins, so device logins never expire and follow the term change.

## Known caveats
- The 65% comes from copying one anonymous real student's progress records (reading, vocab, mastery, arcade, trail, sprite, XP, checklist ticks). Not copied: Cost of Your Future, notes, live sessions, Ask Mr. Dopp. Orion was told and hasn't objected. He may want made-up data instead.
- After the trimester rollover (T2 starts 2026-12-01), Pilot's % will shift because the checklist counts by trimester dates. Re-seed if needed.
- Pre-existing security holes, **not fixed**, flagged to Orion:
  - `teacher-admin.html` hardcodes its passcode in the page source (public repo) — change it and move the check server-side.
  - The `class_codes` table has anon INSERT/DELETE RLS policies, so anyone can add or delete class codes.
