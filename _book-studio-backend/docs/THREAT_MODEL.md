# Book Studio — threat model checklist

Asset: an unpublished ~13,400-word, 15-chapter manuscript, plus private editorial comments and version history.
Owner: one author. No students, no other users.

Legend: ✅ mitigated on this branch · 🧪 covered by an automated test · ⚠️ residual risk / owner action

## A. Exposure through the public website or repo

| # | Threat | Mitigation | |
|---|---|---|---|
| A1 | Manuscript committed to the public repo (any branch/PR) | Manuscript only ever goes to private Storage via authenticated upload. `.gitignore` blocks Office/audio files in studio folders. `check_public_repo.py` fails on manuscript-type files or the master's file name. | ✅ 🧪 |
| A2 | Secret key shipped in browser code | Browser holds only the public anon key. Edge functions use the caller's own JWT — **no service-role key exists anywhere in this code.** Leak check decodes every JWT in the repo and fails on non-anon roles, `sb_secret_` keys, and AI-provider key patterns. | ✅ 🧪 |
| A3 | "Hidden URL" treated as security | Not relied on. The page is a shell; data requires server-checked identity + 2FA. | ✅ |
| A4 | Studio linked from or indexed via the classroom site | No links, not in sitemap/search; `noindex` meta. Leak check fails if any classroom file mentions it. | ✅ 🧪 |
| A5 | Pages cached offline on a shared/school device | `sw.js` skips `/book-studio/`. Manuscript API calls are cross-origin and never cached by the service worker. | ✅ 🧪 |
| A6 | Misconfiguration points the studio at the student-data project | Shell refuses the class project ref and any key whose payload says `service_role`. | ✅ 🧪 |

## B. Authentication and authorization

| # | Threat | Mitigation | |
|---|---|---|---|
| B1 | Anonymous API access | `anon` role has zero table/function privileges (revoked, overriding Supabase defaults). | ✅ 🧪 |
| B2 | Someone creates an account | Sign-ups disabled; owner invited manually. Even a valid non-owner account (with 2FA) sees zero rows and cannot call any RPC. | ✅ 🧪 |
| B3 | Stolen password | RLS requires `aal = aal2` (TOTP verified) on every read and write; storage too. | ✅ 🧪 |
| B4 | Attacker adds themselves as owner | `studio_owners` has no client privileges at all; only the dashboard/SQL editor can change it. | ✅ 🧪 |
| B5 | Attacker with password enrolls their own TOTP before the owner does | Supabase requires aal2 to add a factor once one is verified. | ⚠️ Owner must enroll 2FA at first sign-in, before anything else (SETUP step 6). |
| B6 | Brute-force sign-in / code guessing | Supabase Auth per-IP rate limits; generic error text; 12+ char password. | ✅ ⚠️ use a unique password from a password manager |
| B7 | Session left open on a shared computer | Session stored in `sessionStorage` (ends with the tab), 30-min idle lock, sign-out clears memory by reloading. | ✅ |
| B8 | Cross-site use of the owner's session | Edge functions only answer `https://doppsclass.com` origins; CORS denies others. Supabase JWTs are bearer tokens, not cookies, so CSRF does not apply. | ✅ |

## C. Integrity of the book

| # | Threat | Mitigation | |
|---|---|---|---|
| C1 | Accidental or malicious overwrite | Clients cannot UPDATE/DELETE chapters. Text changes only via `approve_proposal` / `rollback_chapter`. | ✅ 🧪 |
| C2 | History tampering | Triggers make masters, versions and the audit log append-only — even for a database superuser session. | ✅ 🧪 |
| C3 | Two edits race; one silently lost | Proposals pin a base version; approving a stale one is refused. | ✅ 🧪 |
| C4 | Re-import clobbers edited text | Later imports create proposals, never overwrite. | ✅ 🧪 |
| C5 | Forged "already approved" proposals | Insert policy only allows `pending`, no decision fields, author = caller. | ✅ 🧪 |
| C6 | Runaway script / compromised session mass-edits | Per-user rate limits on approve, rollback, import, export, propose; every action logged with before/after IDs. | ✅ 🧪 |
| C7 | Uploaded master replaced in Storage | No UPDATE policy on storage objects; manuscript uploads cannot be deleted from the client. | ✅ 🧪 |

## D. Browser-side attacks

| # | Threat | Mitigation | |
|---|---|---|---|
| D1 | XSS via manuscript, comment or AI-proposed text | All user content rendered with `textContent` / text nodes; no `innerHTML` with data. | ✅ |
| D2 | Injected third-party script steals the session | Strict CSP: scripts from same origin only, no inline script, connections only to `*.supabase.co`. supabase-js is vendored, not loaded from a CDN. | ✅ 🧪 |
| D3 | Referrer leaks | `no-referrer` meta + edge function headers. | ✅ |

## E. Residual risks / owner actions

- ⚠️ **GitHub Pages cannot send security headers** (no `frame-ancestors`, HSTS is GitHub's). Clickjacking risk is low (nothing on the page acts on a single click without a confirm dialog). Moving the shell behind a host that sets headers would close it.
- ⚠️ **Supabase as a processor**: the manuscript sits in Supabase (encrypted at rest, US-West). Read their terms if publishing contracts require it.
- ⚠️ **Backups**: Supabase daily backups on paid tiers. Also keep the original `.docx` offline and use "Dated masters → Download" periodically.
- ⚠️ **Recovery codes**: Supabase TOTP has no built-in recovery codes. Enroll a second authenticator (e.g. a password manager) so a lost phone doesn't lock you out; worst case, the factor can be removed from the dashboard.
- ⚠️ **Edge functions not yet exercised live** (by design). First run happens on the dedicated project after approval, with the RLS tests repeated there.
