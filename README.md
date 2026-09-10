# Training tracker

A phone-first workout logger for one person: me. Hyrox and CrossFit sessions,
planned versus actual, with runs pulled in from Garmin overnight.

Live at [train.aaroncurtisyoga.com](https://train.aaroncurtisyoga.com), gated on
a Clerk admin role. There is no signup, no multi-tenancy, and no `userId` column
anywhere. Every row belongs to me, which is why the schema looks the way it does.

## What it does

**Plans a day, logs what actually happened.** Three sources feed the plan: an
authored Hyrox program in `app/_lib/data/hyrox-plan.json` seeded as
`PlannedSession` rows, the CrossFit DC workout of the day, and manual entry.
Logging a session matches it back to the prescription by movement name.

**Pulls runs from Garmin.** A nightly cron imports activities, upserts them by
`garminId`, and auto-creates linked RUN sessions so a run never needs logging by
hand. It also imports daily readiness metrics.

**Survives a bad gym connection.** The logger queues writes per movement and
drains them in order, keeping the newest state when a request fails and showing
a retry affordance rather than losing the set you just did.

## Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Prisma 6 against
Postgres on Neon, Clerk for auth, Recharts for trends, Tailwind 4. Deployed on
Vercel with one daily cron. Ten runtime dependencies.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
npm run check          # eslint + tsc, run before committing
npm run validate       # check + build
npm run test:e2e       # Playwright
```

Copy `.env.example` to `.env.local` and fill it in. Seven variables, listed there
with what each one is for.

Migrations use `prisma migrate diff` + `migrate deploy`, never `migrate dev`. The
Prisma CLI reads `.env` and not `.env.local`, so prefix commands with
`npx dotenv-cli -e .env.local --` or keep the two `POSTGRES_` URLs in `.env`.

## Operational notes

Things that fail quietly, so they're written down.

**The Postgres URLs are hand-maintained.** This app uses the `training` database
inside the same Neon project as aaroncurtisyoga.com, on the same compute
endpoint. The site's project gets its `POSTGRES_` values from Vercel's Neon
integration; this one does not. When those credentials rotate, the site updates
itself and this app starts failing with a confusing auth error. Update both.

**Garmin auth stores no password.** `npm run garmin:login` does the OAuth
exchange once and writes `{ oauth1, oauth2 }` to the gitignored
`.garmin-tokens.json`, good for about a year. `GARMIN_TOKENS` holds that JSON
verbatim on Vercel, and `loadTokens()` reads the env var first, falling back to
the file. When the nightly sync starts failing, expired tokens are the first
thing to check.

**`CRON_SECRET` gates the nightly job.** `assertCronRequest` returns 401 when
it's unset, so a missing value stops the Garmin import with no symptom beyond a
line in the Vercel cron log and, eventually, a gap in the trends chart.

**Don't drop the `api/cron/` exclusion from the proxy matcher.** Without it the
cron hits the admin gate, follows the redirect to `/sign-in`, and returns 200
HTML. `assertCronRequest` never runs, Vercel logs a success, and the import
silently stops.

**Seeds self-heal.** `ensureMovementLibrary()` and `ensureHyroxPlan()` run lazily
on the first visit, so a fresh environment repairs itself with no seed command.
Re-seeding the plan means deleting the `AUTHORED` rows first.

## History

This started as `/train` inside
[aaroncurtisyoga.com](https://github.com/aaroncurtisyoga/aaroncurtisyoga.com),
my yoga teaching site, and was split out so a personal workout log wasn't sharing
a process with Stripe keys and a Google service account. The cut was clean: no
foreign key crossed between the six training models and the nine site models.
