# The Circumpunct — Private Book Studio (Claude implementation brief)

## Context
This is the public GitHub Pages repository for doppsclass.com. Build an entirely separate author-only Book Studio. It must not appear in menus, search, sitemap, navigation, lesson pages, or student experiences.

**CRITICAL SECURITY:** An unlinked page is NOT private. GitHub Pages is public, and any manuscript committed to this repository (even on a branch or in a PR) may be exposed. Do NOT commit the manuscript, unpublished book text, private notes, authentication secrets, or private audio files here. Do not rely on an obscure URL, client-side password, robots.txt, or JavaScript checks for access control.

## Desired author experience
- A private URL on the doppsclass.com domain, ideally `https://doppsclass.com/book-studio/`, with genuine server-side authentication.
- 15-chapter manuscript reader, chapter navigation, progress/bookmarks, dark/light mode, mobile-friendly layout.
- Listen to chapters with browser speech synthesis (voice/rate/pause/resume/seek when feasible), with optional future server-generated audio.
- Highlight a passage and leave a private editorial comment; store comments, revisions, and version history securely.
- Preserve immutable dated master; changes are proposed, diffed, and explicitly approved before replacing current text.
- Export manuscript as DOCX and Markdown; import DOCX through an authenticated backend.
- Allow Claude to develop via this repo, and ChatGPT to work through an explicitly authorized API/integration later. Do not assume chat histories sync automatically.

## Architecture
GitHub Pages remains the public classroom website. A static `book-studio/` route may show a non-sensitive login/loading shell, but all manuscript data must be served from a separate authenticated backend (for example Supabase Auth + private Postgres/Storage, with strict row-level security). Prefer an author-only server-hosted route on the same domain if hosting supports it. Confirm the current domain/DNS/hosting architecture before implementation.

- Implement owner-only authentication and session handling; deny unauthenticated API requests server-side.
- Store chapters, annotations, revisions and audio in private backend tables/buckets with row-level security.
- Never embed service-role keys, AI provider API keys, private manuscript, or secret URLs in browser code.
- Rate-limit privileged endpoints; log edits and allow rollbacks.
- No student data and no links from the school site.
- Provide a threat-model checklist and tests proving unauthorized users cannot fetch content.
- No production deployment without owner approval.

## Manuscript source
The author has preserved a Word manuscript called `The_Circumpunct_Master_2026-10-31.docx` (approximately 13,432 words, 15 chapters) in ChatGPT. This file has NOT been added to GitHub. Request secure ingestion through an authenticated upload into private storage after the backend is ready. Do not ask to paste manuscript into a public GitHub issue/PR.

## First deliverable
1. Inspect the existing static site, GitHub Pages publishing, and domain setup.
2. Propose an implementation plan that protects the unpublished book.
3. Implement an initial secure login shell and private backend in a reviewable branch.
4. Provide screenshots/tests and a draft PR; wait for approval before publishing.
