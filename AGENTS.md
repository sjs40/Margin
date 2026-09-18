<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Treat follow-on work as setup and iteration on the existing product, not a rebuild; implement completely rather than stopping after a plan; do not switch stacks (no Clerk, Auth.js, Neon, Vercel AI SDK, or Workflow SDK).
- Do all work inside `margin/`; the parent `Margin/` folder exists only because create-next-app rejected a capital M.
- Prefer MCP tools and pasted env values over asking to open dashboards; never echo secrets in chat, logs, or commits; never commit `.env.local`.
- Do not create or force a GitHub remote unless asked; start new branches from latest `origin/main`, avoid overlapping PRs that reimplement the same area, merge `origin/main` before opening or updating a PR, and resolve conflicts in the working tree rather than leaving GitHub conflict resolution to the user.
- Paste URLs into the existing capture box; recognize links without special capture UI.
- Friends can sign up on the live site with isolated notes and add their own Gemini keys; start with 5 hosted AI actions per day on the operator key, with an admin toggle to switch to BYOK-only.
- Admin reuses the existing Margin login via `ADMIN_EMAIL`; do not collect a separate admin password in chat.
- Save is synchronous and must never block on AI or price fetches; AI runs via `after()`; `notes.original_raw_text` is immutable after insert; AI failure never deletes source content; never silently overwrite user-edited knowledge.
- Gemini keys and the Supabase service role never reach the browser; all Gemini calls go through `src/ai/*`, and feature code never imports the SDK.
- New schema changes are new numbered files under `supabase/migrations/` (never edit existing migrations); take the next migration number from `origin/main`, not a stale local `main`; update `DATABASE.md` and README for every migration; run typecheck, lint, and tests after workstreams.
- Cashtags like `$NVTS` are tickers; dollar amounts like `$61` or `$4.21` are not.
- Margin is research memory, not a call tracker, price-charting product, generic notes app, chat wrapper, or agent runtime; keep notes distinct from imported documents and do not add documents to Today.

## Learned Workspace Facts

- Margin is an investment-research capture and memory PWA: Next.js App Router, TypeScript, Tailwind, and shadcn/ui.
- Backend is Supabase (Auth, Postgres, Storage, pgvector); AI is Gemini via `@google/genai`; nightly work is `vercel.json` cron to `/api/cron/nightly`.
- App root is `C:\Users\sam\CursorCode\Margin\margin`. GitHub user is `sjs40`; the public repo is `sjs40/Margin`; Vercel project `margin` is Git-linked to it on `main`.
- Browser clients must read `NEXT_PUBLIC_SUPABASE_*` via static `process.env.NEXT_PUBLIC_*` access so Next can inline the keys.
- Raw notes must persist even when Gemini is unconfigured, quota is exhausted, or a user key is missing.
- Auth is email/password; confirm-email stays off because there is no SMTP (no magic links).
- Sharing model is live hosted signup plus a public self-host repo; per-user Gemini keys are encrypted server-side and always win; `hosted_ai_enabled` in Postgres gates the 5-action hosted trial; one action is one user job, not each inner Gemini request; nightly cron does not spend the hosted allowance.
- Capture extracts URLs from the existing textarea; `$TICKER` cashtags resolve against the shared company universe.
- `entities` is a shared authenticated-readable universe written only through the service-role pipeline; unknown tickers go to Inbox instead of auto-creating entities; user-owned tables use RLS `user_id = auth.uid()`.
- Dual desktop/phone layout: desktop-first PWA with a mobile bottom nav; keep Capture, Today, Research, and Inbox as primary nav; Knowledge lives under Research; Develop is an object action, not a chat page.
- Insights and Frameworks are first-class `knowledge_objects` (not Themes); Daily Meta Notes archive at `/today/archive` and `/today/[YYYY-MM-DD]`; Loose Ends defer to Inbox as `deferred` with a `loose_end` inbox pointer without duplicating the canonical question/follow-up; originating source is `note_id`/`document_id`, not `resolved_by_note_id`; Inbox stays decision-only.
- Model IDs come from env via `src/lib/env.ts`; prompt versions are bumped when prompts change and recorded on `ai_jobs`; clock times parse through `src/lib/dates.ts` and format in the browser timezone so minutes stay correct.
