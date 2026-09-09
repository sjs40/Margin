# Margin

Investment-research capture and memory. Type a thought, save it in seconds, then let organization happen afterward.

Try the hosted app: [margin-psi-three.vercel.app](https://margin-psi-three.vercel.app)

Create an account, then add your own [Gemini API key](https://aistudio.google.com/apikey) in Settings. Raw notes always save, even before a key is added. The hosted app may offer a small daily AI allowance; that can be turned off by the operator.

## Stack

- Next.js + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Storage, pgvector)
- Google Gemini (`gemini-3.7-flash`, `gemini-embedding-2`)
- Vercel (app + nightly cron at `/api/cron/nightly`)

## Local development / self-host

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or a publishable key)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (server key for you / hosted trial)
- `AI_KEY_ENCRYPTION_SECRET` (long random string; encrypts user keys at rest)
- `ADMIN_EMAIL` (the login that can open `/admin`)
- `CRON_SECRET` (a long random string for the nightly job)

Never commit `.env.local`.

3. Apply SQL in order:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_match_embeddings.sql`
- `supabase/migrations/0003_note_links.sql`
- `supabase/migrations/0004_user_ai_keys.sql`

Optional sample tickers: `supabase/seed.sql`.

4. Enable email/password Auth. Turn **off** "Confirm email" unless you have SMTP, or new accounts will not get a session.

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start typing.

Model IDs live in `.env.local`, not in feature code.

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

On a phone, use Add to Home Screen (iOS Safari) or Install app (Chrome) from the browser menu. Camera capture uses the browser file input with `capture="environment"`. Paste a URL into the capture box with your comments; Margin extracts the link and fetches a title/excerpt when it can.
