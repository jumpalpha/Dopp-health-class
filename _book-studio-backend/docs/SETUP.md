# Book Studio — go-live steps

**Do none of this until the owner approves.** Each step says where to click and what you should see.

## 1. Create the dedicated Supabase project

1. supabase.com → your organization → **New project**.
2. Name: `circumpunct-book-studio`. Region: West US. Generate a strong database password and store it in a password manager (it never goes in this repo).
3. Expected: a new project with its own URL `https://<ref>.supabase.co`. **It must not be `gmeyamrlqfrabtslsweu`** (the class project).
   Your org already has two free projects, so this one is likely billed (Supabase shows the price before creating).

## 2. Lock down Auth (Dashboard → Authentication)

- **Sign In / Providers → Email**: enabled. **Allow new users to sign up: OFF.**
- **Multi-Factor**: TOTP **enabled** (enroll + verify).
- **URL Configuration**: Site URL `https://doppsclass.com/book-studio/`.
- **Rate Limits**: leave defaults or lower.
- Expected: no public sign-up possible.

## 3. Create the owner account

- **Authentication → Users → Add user → Create new user**: your email + a unique 16+ character password. Tick "Auto confirm".
- Copy the new user's **UID**.

## 4. Apply the schema

SQL Editor → paste and run, in order:
1. `_book-studio-backend/supabase/migrations/20261031000100_book_studio_core.sql`
2. `_book-studio-backend/supabase/migrations/20261031000200_book_studio_storage.sql`
3. Then (replace the UID):
   ```sql
   insert into public.studio_owners (user_id, note) values ('<your-UID>', 'author');
   ```
- Expected: "Success. No rows returned" for each. **Advisors → Security** should show no RLS warnings for these tables.

## 5. Deploy the edge functions

With the Supabase CLI, from `_book-studio-backend/`:
```bash
supabase link --project-ref <ref>
supabase functions deploy import-docx
supabase functions deploy export-docx
supabase secrets set STUDIO_ALLOWED_ORIGINS=https://doppsclass.com
```
No other secrets are needed — the functions never use a service-role key.

## 6. Connect the shell and enroll 2FA immediately

1. Put the project URL and **anon / publishable** key (Settings → API) into `book-studio/config.js`. Never the service-role / secret key.
2. Run `python3 _book-studio-backend/tests/check_public_repo.py` → "Leak check passed".
3. Merge to `main` (after approval) and open `https://doppsclass.com/book-studio/`.
4. Sign in → scan the QR code → enter the code. **Do this right away**, before anything else.
5. Optional: enroll a second authenticator as a backup.

## 7. Prove it's private (on the live project)

- In a private window, not signed in, open the browser console on the studio page and run:
  ```js
  fetch(BOOK_STUDIO_CONFIG.supabaseUrl + '/rest/v1/chapters?select=*', { headers: { apikey: BOOK_STUDIO_CONFIG.supabaseAnonKey } }).then(r => r.status)
  ```
  Expected: **401** or **403** (permission denied), never 200 with data.
- Optionally create a throwaway second user, sign in as them with 2FA → "This account is not authorized." Then delete that user.

## 8. Import the manuscript

⋯ → **Import Word file…** → choose `The_Circumpunct_Master_2026-10-31.docx` → date 2026-10-31 → **Upload securely**.
Expected: "Imported 15 sections · ~13,432 words · 15 new". Check **Dated masters** shows it, and spot-check chapter titles.
