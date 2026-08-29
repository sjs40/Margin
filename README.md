# Margin

Personal investment-research capture and memory. Type a thought, save it in seconds, then let organization happen afterward.

V0.1 is a single-user PWA for one public-equity analyst. It is not a multi-tenant product.

## Stack

- Next.js + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Storage, pgvector)
- Google Gemini (`gemini-3.7-flash`, `gemini-embedding-2`)
- Vercel (app + nightly cron at `/api/cron/nightly`)

## Local development

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or a publishable key)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CRON_SECRET` (a long random string for the nightly job)

Never commit `.env.local`.

3. Apply SQL in order:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_match_embeddings.sql`

Optional sample tickers: `supabase/seed.sql`.

4. Enable email/password Auth. For local use, turn off "Confirm email" or you will not get a session without SMTP.

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start typing. Raw notes save even if `GEMINI_API_KEY` is missing. AI processing needs that key.

Model IDs live in `.env.local`, not in feature code. Create a Gemini key in Google AI Studio.

## Tests

```bash
npm run test
npm run typecheck
npm run lint
```

Playwright (`npm run test:e2e`) checks the login gate. Authenticated capture flows need a live Supabase project.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AI_PIPELINE.md](./AI_PIPELINE.md)
- [DATABASE.md](./DATABASE.md)

## Deployment

Deploy to Vercel with the same environment variables. `vercel.json` schedules `GET /api/cron/nightly` with `Authorization: Bearer $CRON_SECRET`.

Install the PWA from a mobile browser when prompted. Camera capture uses the browser file input with `capture="environment"`.
