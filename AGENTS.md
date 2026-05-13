# AGENTS.md

Guidance for Codex and other coding agents working on the Dopp Health Class website.

## Project Overview

This repo powers the public website at:

- https://doppsclass.com
- GitHub repo: https://github.com/jumpalpha/Dopp-health-class

The site is a mostly static HTML/CSS/JavaScript website for a health class curriculum, including:

- The homepage: `index.html`
- Chapter pages: `chapter01.html` through `chapter28.html`
- Realm pages: `realm1.html` through `realm9.html`
- Dopp arcade games: `dopp_*.html`
- Classroom game templates: `game01_*.html` through `game15_*.html`
- Shared styling/scripts where present: `shared.css`, `shared.js`

The user prefers plain, step-by-step help and non-technical explanations when possible.

## Working Rules

- Make focused changes. Do not redesign unrelated parts of the site during a small request.
- Preserve the simple static-site structure unless the user explicitly asks for a framework or build system.
- Prefer editing existing HTML/CSS/JS directly.
- Do not remove pages, games, or curriculum content unless the user clearly asks or a page is broken beyond reasonable repair.
- Before changing game behavior, check that the game still has clear instructions, visible feedback, and a reachable win/complete state.
- Keep student-facing text friendly, clear, and age-appropriate.

## Visual Style

The site uses a fantasy/health quest theme:

- Gold: `#FFD700`
- Emerald: `#00E5A0`
- Sky blue: `#38BFFF`
- Crimson: `#FF3B5C`
- Dark fantasy backgrounds with readable contrast

When adjusting visuals:

- Prioritize readability and contrast.
- Keep gold text legible with dark outlines/shadows where needed.
- Avoid making the homepage feel like a plain corporate site.
- Maintain the fantasy quest tone, but do not let decoration make text hard to read.

## Games Guidance

For `dopp_*.html` games:

- Games should be sprite-like or canvas/CSS drawn rather than relying only on large emoji when possible.
- Games should be winnable, completable, or have an obvious success state.
- If a game is too hard, confusing, or impossible to win, fix the mechanics before considering removal.
- Mobile/touch controls matter because students may use phones, tablets, or Chromebook touchpads.
- Use achievable targets for student-friendly gameplay.
- Keep health facts or wellness tie-ins visible but not intrusive.

Recent game direction:

- Memory Match and Wordle were moved toward sprite-style visuals.
- Many Dopp games now have explicit win states.
- Do not regress these win states when editing games.

## Supabase Notes

This site has used Supabase for class/student features.

When touching Supabase code or database rules:

- Treat student data as sensitive.
- Do not expose private student progress publicly.
- Prefer Row Level Security policies that restrict public access.
- If giving SQL to the user, explain exactly where to paste it and what result to expect.
- Avoid destructive database changes unless the user explicitly confirms.

## Deployment

The site is deployed from GitHub Pages through the `main` branch.

Normal workflow:

1. Edit files locally.
2. Run quick checks such as `git diff --check`.
3. Commit with a clear message.
4. Push to `origin main`.
5. Verify GitHub has the updated code. The live site may take a short time to refresh.

Useful commands:

```powershell
git status --short
git diff --check
git add <files>
git commit -m "Clear message"
git push origin main
```

## Testing

This is a static site, so many pages can be checked by opening the HTML file or using a local/static browser check.

Before finishing work:

- Run `git diff --check`.
- For HTML/JS game edits, check brace/script balance when practical.
- For interactive changes, use a browser or headless browser check when available.
- Confirm the repo is clean after committing and pushing.

## Communication With The User

The user likes step-by-step guidance and clear status updates.

When working:

- Say what you are doing in simple terms.
- Avoid dumping raw terminal output unless it matters.
- If a permission or GitHub credential issue blocks progress, explain the next click or action clearly.
- Keep final summaries short and specific: what changed, what was checked, and whether it was pushed live.

