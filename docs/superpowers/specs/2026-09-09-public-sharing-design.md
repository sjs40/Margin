# Public sharing, accounts, and per-user AI keys

Date: 2026-09-09

## Goal

Friends can sign up on the live Margin site with isolated notes, add their own Gemini API key, and optionally use five hosted AI actions per day on the operator’s key. The GitHub repo is presentable for self-hosters. An admin page can turn the hosted allowance off (BYOK-only).

## Constraints

- Keep Next.js, Supabase Auth (email/password), Gemini via `@google/genai`, Vercel. No Clerk, Auth.js, Neon, or Vercel AI SDK.
- Raw notes still persist when AI is unavailable.
- Never send Gemini keys or the service role to the browser.
- Admin is the existing account `ADMIN_EMAIL` (operator login). No separate admin password.

## Architecture

- `app_settings` singleton row: `hosted_ai_enabled` (default true), `hosted_ai_daily_limit` (5).
- `user_ai_keys`: encrypted Gemini key, service-role only (RLS on, no authenticated policies).
- `ai_daily_usage`: `(user_id, usage_date)` with atomic `try_consume_hosted_action`.
- Resolve credentials per request. Bind `GeminiProvider` with `AsyncLocalStorage`. Do not use a process-wide singleton for live keys.
- User key always wins. Admin uses the env `GEMINI_API_KEY` with no quota. Hosted trial users consume one action per user-facing job. Nightly jobs never use the hosted allowance.

## User-facing jobs (one hosted action)

Process/retry a note, handwriting, import, Ask, Refresh Today. Search embeddings run only when a user/admin key is already bound; trial search is lexical-only. Nested work (handwriting → parse, Ask → hybrid search) does not consume a second action.

## Screens

- Login: separate Sign in and Create account. Password only.
- Settings: save/replace/remove Gemini key (never shown again). Remaining hosted actions when relevant.
- Admin: toggle hosted AI; today’s usage counts.
- Header account menu: Settings, Admin (admin only), Sign out.

## Ops

- `ADMIN_EMAIL`, `AI_KEY_ENCRYPTION_SECRET` (plus existing Gemini/Supabase vars).
- Supabase Confirm email remains off so signups work without SMTP.
- Self-hosters set `GEMINI_API_KEY` as today; they can also set `ADMIN_EMAIL` and the encryption secret if they want BYOK + the toggle.
