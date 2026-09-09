# Architecture

Margin is a monolithic Next.js App Router application. There are no microservices, no agent runtime, and no separate vector database.

## Boundaries

- **Browser**: capture UI, navigation, search, PWA shell. Never holds Gemini keys or the Supabase service role.
- **Server actions / route handlers**: persistence, signed storage URLs, AI orchestration.
- **Supabase**: Auth, Postgres+RLS, private Storage, pgvector.
- **Gemini**: generation, vision, and embeddings go through `src/ai` only.

## Product layers

1. **Capture.** Typed notes, camera pages, pasted AI imports. Save is synchronous. AI runs afterward via `after()`.
2. **Research memory.** Parse, resolve entities/themes, store claims/questions/follow-ups, embed, update meta notes.
3. **Analyst interface.** Home, Today, Research, Search/Ask, Inbox.

## Request flow

```
Capture box
  → insert note (raw + original_raw_text)
  → return immediately
  → after() processTextNote
      → parseNote
      → resolve companies/themes
      → store claims/questions/follow-ups
      → embed
      → mark ready (or failed + Inbox)
```

Handwriting adds Storage + `interpretHandwriting` before `parseNote`. Imports create a `documents` row, then `parseAIImport`, chunk, and embed.

Nightly synthesis (`/api/cron/nightly`) and the Today refresh button call the same `upsertDailyMetaNote` / `runNightlyIntelligence` functions.

## Auth

Supabase Auth with `@supabase/ssr`. `src/proxy.ts` refreshes cookies and redirects anonymous users to `/login`. Row Level Security scopes user-owned rows by `user_id = auth.uid()`. Entity records are a shared ticker universe readable by authenticated users; writes happen through the service-role pipeline. Each user can store an encrypted Gemini key. The operator account (`ADMIN_EMAIL`) can toggle a hosted trial of five AI actions per day.

## Failure rule

AI failure never deletes source content. Processing status becomes `failed`, a retry exists, and Inbox records the incident.
