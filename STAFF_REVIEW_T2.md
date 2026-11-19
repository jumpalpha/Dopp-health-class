# For the Chief of Staff: T2 site review (doppsclass.com)

From: Claude (chat session, 2026-11-18) · To: Chief of Staff, Alan's Staff · Status: OPEN

## Ask
Before Trimester 2 starts (Dec 1, 2026), review doppsclass.com as a brand-new student and bring Orion
a short list of further improvements, agreed by the team (software developer, customer care, strategist,
statistician). Ask Orion one question at a time, multiple choice, A–D with a recommendation.

## Already done (2026-11-18)
- New pages: `start.html` (Start Here guide) and `tour.html` (12-stop interactive tour, "Where do I find…?" helper, Find It challenge).
- `student_guide.js` (loaded by `theme.js`): "Start Here" menu link (signed-in students see "Today"), a ❓ Help button on every non-game page, and a home-page banner.
- `guide_data.js`: tour stops + 40 "Where do I find…?" answers. Edit answers there.
- Quest sign-up now asks for a real first name; Quest realm section points to the Checklist.
- Footer "Local preview build" text replaced on all compiled pages.
- Restore point: branch `backup-pre-T2-review-2026-11-18` (commit 3d71255).

## Decided by Orion (2026-11-18) and built
- Quest realm tasks retired as a to-do list: realms now show Checklist progress; the old task keys (XP + realm badges) are awarded automatically when a realm's Checklist items are all done. Earned XP kept.
- Returning students land on Today on their first home-page visit each day (`/?home` skips it).
- Classwork required from T2 (already automatic in checklist.js) and "✏️ Classwork" added to the top menu.

## Open issues for the team to weigh
1. ~~**Two to-do systems.**~~ (decided: see above) Quest page realm tasks ("Read Chapter 1 PDF", "Habit Tracker", boss battles, +25 XP each)
   don't match the Checklist (reader, 4 vocab games, Classwork, Mastery, Schoology boxes). New students will be confused.
   Options: retire Quest tasks, hide them behind "XP extras", or rewrite them to mirror the Checklist.
2. ~~**Today screen was orphaned.**~~ (decided: see above) The remembered-device redirect to `welcome.html` lived on the old home page; the Next.js
   home dropped it. Now linked from the menu and home banner. Decide whether returning students should auto-land on Today.
3. ~~**Classwork in T2.**~~ (decided: see above) It's "optional, counts as done" in T1 (`cfg.cw_required === false`). Confirm it's required for T2,
   and whether it gets its own top-menu link.
4. **Naming.** "Hall" (menu) vs "Hall of Champions" (home/search) vs "Hall of Heroes" (page title); "Enter the Quest" goes to
   Chapters, not the Quest page; "Side Quests: nothing to turn in" but some are assigned with Schoology uploads.
5. **Menu length.** 9 top links plus Checklist. Consider grouping (Learn / Play / Me).
6. **Chapter page details.** Next.js chapter pages show lesson chips (e.g. "L1: What is Health?") that don't match the
   actual lesson titles in the reader; "Days 1–2" schedule labels should be checked against the T2 calendar.
7. **Build tool.** `tools/build_pwa.py` fails ("could not read the game list from arcade.html"); the arcade page moved to Next.js.
8. **Help analytics.** Optional: count (anonymously) which "Where do I find…?" questions get no match, to grow `guide_data.js`.
