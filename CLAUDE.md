# training-tracker

Private, single-user Hyrox/CrossFit training tracker at `train.aaroncurtisyoga.com`.
Split out of `aaroncurtisyoga.com` (the yoga business site), where it lived at
`/train`. Admin-gated in `proxy.ts`; there is exactly one legitimate user.

## Stack

- **Next.js 16** + React 19 + TypeScript. `strict: false` but `strictNullChecks: true`,
  plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **Prisma 6** + Postgres, the `training` database in a Neon project shared with the site
- **Clerk** for auth, same production instance as the site
- **Recharts** for trends, **garmin-connect** for the nightly import
- **Tailwind 4**, CSS-first. No `tailwind.config.js`, no shadcn, no animation plugin
- Deploy: **Vercel**, one daily cron

## Commands

```bash
npm run dev
npm run check            # eslint + tsc --noEmit, run before committing
npm run validate         # check + build
npm run test:e2e         # Playwright
npm run garmin:login     # one-time Garmin OAuth token mint
npx prisma studio
```

Migrations: `npx prisma migrate diff` + `npx prisma migrate deploy`, never
`migrate dev`, never `db push`. The Prisma CLI reads `.env`, not `.env.local`.

## Conventions and gotchas

### Routing

- Route protection lives in `proxy.ts` (Next 16's name for middleware), not `middleware.ts`
- The whole origin is admin-only. Signed out gets a redirect to `/sign-in`;
  signed in without the admin role gets a 404, not a 403
- **The `api/cron/` exclusion in `config.matcher` is load-bearing.** Drop it and
  the nightly cron gets a 307 to `/sign-in`, follows it, returns 200 HTML,
  `assertCronRequest` never runs, and Vercel logs a success while the import dies
- `authorizedParties` is an exact-match array with no wildcard support. It lists
  every host that legitimately serves this Clerk instance. A missing entry 401s
  that host on every authenticated request, so it has to stay in sync with the
  same list in the site's repo

### Auth

- Same Clerk production instance as `aaroncurtisyoga.com`. Sessions are shared
  across subdomains of the root domain by default, so there is **no** satellite
  config here: no `isSatellite`, no `NEXT_PUBLIC_CLERK_DOMAIN`, no
  `allowedRedirectOrigins`. Passing `allowedRedirectOrigins` would replace
  Clerk's defaults wholesale, and the defaults already cover `*.aaroncurtisyoga.com`
- Expect one visible 302 to `clerk.aaroncurtisyoga.com` on the first navigation
  here, and another on any hop between the site and this app. `__client_uat` is
  domain-scoped but `__session` is host-only, so the handshake mints a fresh
  host-local session. That's designed behavior, not a redirect loop
- Local dev proves nothing about this. Every relevant path in `@clerk/backend`
  branches on `instanceType === "development"` and uses a different cookie model

### Dates

- Training tables use `@db.Date`, which Prisma encodes as UTC midnight. Use
  `etToday()` / `dateFromYmd()` / `ymdFromDate()` from `app/_lib/utils/training-date.ts`,
  and format day labels with `timeZone: "UTC"` or they shift a day
- The training day itself follows America/New_York

### Data access

- **No caching anywhere in `training.actions.ts`, on purpose.** The traffic is
  one private user, and stale reads would fight the last-used-weight pre-fill.
  All three pages are `export const dynamic = "force-dynamic"`
- Server actions surface failures by throwing; the catch does `return handleError(error)`
  (typed `never`) and the client wraps the call in try/catch
- Serialize Prisma objects crossing to a client component with `serialize()`
  from `app/_lib/utils/serialize.ts`; it returns `Serialized<T>` where Dates
  become ISO strings

### Duplication with the site repo, on purpose

`prisma.ts`, `requireAdmin()`, `serialize.ts`, `assertCronRequest`, `cn` and
`handleError` are copied from `aaroncurtisyoga.com` rather than shared. That's
about 85 lines. Extracting a package for 85 lines would cost more than the
duplication does. The tradeoff is that these can drift, and nothing will tell
you which copy is correct, so fix bugs in both.

### Lint

`eslint-plugin-react-hooks` 7.x runs its rules as errors. Don't disable them.

- Syncing state from a prop via `useEffect` fails `react-hooks/set-state-in-effect`.
  Use React's render-phase adjustment instead (see `inputs.tsx`, `NumField`/`TimeField`)
- A self-recursive `useCallback` fails `react-hooks/immutability`. `drain` in
  `Logger.tsx` uses an outer loop instead of a tail call for this reason

### Adding a movement

Add a seed to `DEFAULT_MOVEMENTS` in `app/_lib/constants/training.ts`. Names must
match the Hyrox plan wording, since planned-versus-actual matching is by name.

## Structure

```
app/
├── (auth)/sign-in/         # Clerk <SignIn/>, shipped here so redirect_url stays host-relative
├── _components/            # Logger, TrainHome, TrendsView, MovementCard, PlanCard, RestTimer…
├── _lib/
│   ├── actions/training.actions.ts
│   ├── constants/training.ts       # DEFAULT_MOVEMENTS, HYROX_RACE_YMD
│   ├── data/hyrox-plan.json        # authored plan, seeded as AUTHORED rows
│   ├── services/garmin-sync.ts     # nightly import + linked RUN sessions
│   ├── services/pushpress-wod.ts   # CrossFit DC WOD; a public API, not scraping
│   ├── types/training.ts, types/globals.d.ts
│   ├── utils/{index,serialize,training-date}.ts
│   ├── prisma.ts, auth.ts, api-auth.ts
├── api/cron/sync-garmin/   # nightly, 2 AM UTC
├── log/[id]/, trends/, page.tsx
├── layout.tsx, providers.tsx, globals.css, robots.ts
prisma/schema.prisma        # 6 models, 6 enums, no userId on any of them
e2e/                        # Playwright: gate, navigation, logger
scripts/garmin-login.ts     # one-time OAuth token mint
proxy.ts
```

## Database

Six models, no `userId` on any of them.

- **Movement**: canonical library; name unique, category, unitType, defaultUnit
- **PlannedSession**: a day's prescription; world (HYROX/CROSSFIT), source
  (AUTHORED/PUSHPRESS/MANUAL), `blocks` Json, unique sourceId
- **LoggedSession**: one thing actually done; date, activityType, rpe, felt, durationMin, score
- **LoggedMovement**: per-movement sets within a logged session
- **GarminActivity**: imported activity, upserted by `garminId`, optionally linked to a LoggedSession
- **DailyWellness**: daily readiness metrics

Enums: `MovementCategory`, `UnitType`, `WeightUnit`, `TrainingWorld`,
`PlannedSource`, `ActivityType`.

## PushPress is a public API

`pushpress-wod.ts` GETs `trainapi.pushpress.com/workout/workoutOfDay/v1` with a
hardcoded tenant id, unauthenticated, 6s timeout. No scraping, no Playwright.
