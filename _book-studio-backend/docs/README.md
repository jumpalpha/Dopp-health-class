# Circumpunct Book Studio — implementation notes

Status: **first deliverable, not deployed.** Nothing has been applied to any Supabase project, and `book-studio/config.js` is blank, so the shell on this branch cannot reach any backend.

## 1. What I found (hosting and domain)

| Item | Finding | Consequence |
|---|---|---|
| Hosting | GitHub Pages from `main`, custom domain via `CNAME` = `doppsclass.com` | Static files only. No server-side routes, no response headers, no access control. |
| Repo visibility | **Public** | Anything committed (any branch, any PR) is world-readable. The manuscript must never enter git. |
| Build | No `.nojekyll`, no Actions workflow → classic Jekyll build | Folders starting with `_` are normally not published, so `_book-studio-backend/` (SQL, edge functions, tests) should not appear on the live site. Not relied on for security — none of it is secret. **Verify after merge.** |
| Existing backend | Supabase project `dopp-health-class` (student data) | **Not used.** The studio gets its own dedicated project so a leaked class key can never expose the book, and vice versa. |
| Service worker | `sw.js` caches every same-origin page a student opens | Added an explicit exclusion so `/book-studio/` is never stored offline on any device. Supabase calls were already uncached (cross-origin). |
| Search / sitemap / nav | No references to the studio anywhere | Kept that way; `check_public_repo.py` fails the build if one appears. |

## 2. Architecture

```
doppsclass.com/book-studio/   (GitHub Pages, public)
  index.html + studio.js       sign-in shell only — no book text, no secrets
          │  HTTPS, owner JWT (aal2)
          ▼
Dedicated Supabase project "circumpunct-book-studio"
  Auth        email+password, TOTP 2FA required, sign-ups disabled
  Postgres    RLS on every table: owner listed in studio_owners AND aal = aal2
  Storage     private buckets: manuscripts (.docx masters), audio (future)
  Functions   import-docx, export-docx — run AS the owner (no service key)
```

Same-domain URL without a server: the URL lives on doppsclass.com, but the page is only a shell. Every byte of manuscript comes from the backend after the server has checked identity + 2FA. Knowing the URL gives an attacker a login box and nothing else.

## 3. What is on this branch

| Path | Purpose |
|---|---|
| `book-studio/` | Sign-in shell (password → TOTP enroll/verify), reader, chapter nav, progress, bookmarks, dark/light, listen (browser speech: voice, speed, play/pause/resume, paragraph seek), select-to-comment, propose edit, word-level diff review, approve/reject, version history + restore, dated masters, Word import, .docx/.md export, edit log, 30-min idle lock, tab-scoped session. |
| `_book-studio-backend/supabase/migrations/` | Schema, RLS, immutability triggers, approve/rollback/import RPCs, rate limits, audit log, private buckets. |
| `_book-studio-backend/supabase/functions/` | `import-docx` (upload → chapters → immutable master; later imports become proposals), `export-docx`. |
| `_book-studio-backend/tests/` | `test_rls.py` (22 database security tests on real PostgreSQL), `test_chapters.mjs` (Word splitting), `test_ui.py` (24 headless browser checks + screenshots), `check_public_repo.py` (leak guard). |
| `_book-studio-backend/docs/THREAT_MODEL.md` | Threats, mitigations, residual risks. |
| `_book-studio-backend/docs/SETUP.md` | Go-live steps — **only after owner approval.** |
| `sw.js` | One line: never cache `/book-studio/`. |

## 4. How text changes (immutable master → proposals → approval)

1. Import a `.docx` → a **master** row (dated, SHA-256 of the file, word count) plus per-chapter copies. Masters can never be edited or deleted (database triggers block it, even for a superuser session).
2. First import seeds the 15 chapters as version 1.
3. Every later change — typed by the author, written by Claude, a future ChatGPT integration, or a re-import — becomes a **proposal**. Nothing changes until the author opens it, reads the diff, and presses Approve.
4. Approval writes a new immutable **version** and moves the chapter's pointer. A proposal written against an older version is refused (conflict), so nobody's edit silently overwrites another.
5. Rollback copies an old version forward as a new version. History is never deleted. Every action lands in the append-only edit log.

## 5. Claude and ChatGPT access

- **Claude** develops through this repo: code, schema and tests only. Claude never needs the manuscript in git; any manuscript work happens through the owner's authenticated session or text the owner chooses to share in a chat.
- **ChatGPT** (later, not built): a narrowly scoped edge function that accepts *proposals only* using its own revocable key, stored hashed in the database, rate-limited, and labelled `chatgpt`. It could never approve, delete or read beyond what the owner grants. Chat histories do not sync between assistants.

## 6. Running the tests

```bash
python3 _book-studio-backend/tests/check_public_repo.py      # leak guard (run before every commit)
python3 _book-studio-backend/tests/test_rls.py               # needs PostgreSQL server binaries (spins up a throwaway cluster)
python3 _book-studio-backend/tests/test_ui.py --shots out/   # needs Playwright + Chrome
npm i --prefix /tmp/bs mammoth@1.8.0 docx@9.0.2
STUDIO_NODE_MODULES=/tmp/bs/node_modules node _book-studio-backend/tests/test_chapters.mjs
```

## 7. Known limitations (v1)

- Imported text keeps paragraphs but not inline formatting (italics/bold). The original `.docx` is preserved byte-for-byte in private storage and is re-downloadable from Dated masters.
- Browser speech quality depends on the device's installed voices; "seek" is per paragraph. Server-generated audio has a private bucket ready but no generator yet.
- The edge functions were type-checked by review and their pure logic unit-tested, but have not been run against a live Supabase project (by design, until approval).
