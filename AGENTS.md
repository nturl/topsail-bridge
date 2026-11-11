# Topsail Traffic: notes for coding agents

Read `README.md` first; it is the source of truth for features, the code map and configuration. This file only adds what an agent needs to work safely.

## Commands
- Install: `npm ci` (Node 20+). In an Amp orb, `.agents/setup` has already run it.
- Dev server: `npm run dev`. In an orb use `amp orb services ensure` (see `.amp/services.yaml`) and check the page through the portal.
- Checks before any push: `npx tsc --noEmit` and `npm run build`. There is no unit test runner and no linter.
- `npm run smoke -- <base-url>` checks every page and API route. With no argument it hits production, so pass the dev or portal URL when checking local work.

## Rules that are easy to break
- `main` moves on its own. A GitHub Actions cron (`poll.yml`) commits `data/log.ndjson` and `src/data/measured.json` to `main` about every 15 minutes. Never edit those two files by hand, and expect to fetch again before pushing.
- Work on a feature branch and open a pull request. Do not push to `main`.
- Do not deploy. Production ships by hand with `vercel --prod` from the owner's machine, followed by `npm run smoke`. Pushing to `main` does not deploy.
- Every page load of the forecast makes paid Mapbox calls. Without `MAPBOX_TOKEN` the forecast, route map and geocoder return no data by design; that is not a bug. Do not loop over `/api/forecast` or `/api/history` with a real token.
- Do not run `npm run poll`, `scripts/fb-post.mjs` or `scripts/seed-typical.mjs` unless asked. They spend Mapbox calls or post to Facebook.
- Secrets live in GitHub Actions secrets and Vercel env vars, never in the repo.

## Verifying UI work
A change to a page is done when you have loaded it in a browser at phone width (the site is used on phones first) and at desktop width, and said what you saw.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
