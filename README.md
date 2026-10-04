# LostBox

A school lost-and-found that students can actually browse, with privacy built in.
Congressional App Challenge 2026 entry (CA-50).

> **Status:** MVP. Staff sign in with a magic link, set up a school, and post
> found items with photos; students join with a code, browse, and claim; staff
> approve and mark items returned. Deploying: see [`docs/DEPLOY.md`](docs/DEPLOY.md). Running a pilot: [`docs/PILOT.md`](docs/PILOT.md).

## Quick start (demo, no accounts or services needed)

Requires Node 24 (see `.nvmrc`) and pnpm.

```bash
nvm use                      # or install Node 24 any way you like
corepack enable              # makes the pinned pnpm version available
pnpm install
pnpm seed:demo && pnpm dev   # http://localhost:3000
```

- **Student:** open http://localhost:3000 and enter **`DEMO2026`**.
- **Staff:** go to http://localhost:3000/login and sign in as **`demo@lostbox.test`**.
  In demo mode the "magic link" is shown on screen instead of emailed.
- **New school:** http://localhost:3000/setup with any email.
- Stop `pnpm dev` before running `pnpm seed:demo` again (PGlite allows one process
  per database). While the app is running, use **Reset demo data** in `/admin`.

No `.env.local` is needed for the demo: in development the app defaults to
PGlite, demo mode, and a development-only session secret. To change settings,
`cp .env.example apps/web/.env.local`.

Checks (the same ones CI runs):

```bash
pnpm typecheck
pnpm lint
pnpm test            # unit, database, and repository contract tests (PGlite)
pnpm test:e2e        # Playwright: the full loop, privacy, wizard, accessibility
pnpm smoke <url>     # read-only checks against a running deployment
pnpm eval            # search evaluation (eval/README.md); needs your private manifest
```

`pnpm test:e2e` builds the app and uses its own data folder (`.data-e2e/`). It
needs Chromium: `pnpm --filter @lostbox/web exec playwright install chromium`, or
point `PLAYWRIGHT_CHROMIUM_PATH` at an existing Chromium.

## Prototype vs. real deployment

The prototype runs with **no Docker and no cloud accounts**. The database is
[PGlite](https://pglite.dev), real Postgres compiled to WebAssembly, running
inside the Node process and saving to `.data/`.

**For the real deployment, use Supabase** (hosted Postgres, Storage, and Auth).
The SQL migrations in `supabase/migrations/` are written for Supabase and run
unchanged there. Locally, `supabase/local/auth_shim.sql` fakes the few Supabase
pieces they depend on (`auth.users`, `auth.uid()`, and the database roles). Code
reaches the database only through the repository interface in
`apps/web/src/lib/repo/interface.ts`, so switching to Supabase means writing one
new adapter, not changing pages. See `docs/DECISIONS.md`.

### Supabase setup (hosted project)

Migrations go to the hosted database through the Supabase CLI (installed as a
dev dependency), never by pasting into the dashboard, so the database always
matches `supabase/migrations/`.

```bash
pnpm exec supabase login                                   # once per machine, opens a browser
pnpm exec supabase link --project-ref <your-project-ref>   # once per clone; asks for the DB password
pnpm db:status                                             # which migrations the hosted DB has
pnpm db:push:dry                                           # list what db:push would apply, change nothing
pnpm db:push                                               # apply new migrations (ask the team first)
```

Migration files must be named `<number>_<name>.sql` (the CLI skips anything
else). Keep them zero-padded: `0002_...`, `0003_...`.

Auth settings, Vercel environment variables, and SMTP: see
[`docs/DEPLOY.md`](docs/DEPLOY.md).

### Are the local tests testing what's deployed?

The database tests in `apps/web/tests/db/` (tenant isolation, plus a schema
guard that fails if anything in `public` is open to the public API) and the
repository contract in `apps/web/tests/repo/` (every data-layer method, the
visibility rule, isolation through the app's own code) run on PGlite by default.
To run the exact same tests against a hosted project:

```bash
# fill in SUPABASE_TEST_* in apps/web/.env.local (see .env.example)
pnpm test:supabase
```

Use a separate Supabase project for this if you can. Test data uses a
`zz-test-` slug and is deleted afterwards.

## Demo school

`pnpm seed:demo` creates **Demo High School** with the fixed join code
**`DEMO2026`** (real schools get random 8-character codes) and 24 found items:
every category, all three privacy levels, groups of look-alike items (black
water bottles, gray hoodies, earbud cases, calculators), and a few old enough
to donate. The pictures are simple generated SVGs, not real photos. Running it
again resets the demo school to the same state.

## Where things are

| Route | Who | What |
|---|---|---|
| `/` | students | enter a join code |
| `/privacy` | everyone | what LostBox keeps and doesn't, in plain English |
| `/s/[slug]` | students | gallery with search and filters; item pages; claim form |
| `/s/[slug]/status` | students | check a claim with its code |
| `/s/[slug]/poster` | staff | print-ready poster with the QR code and join code |
| `/login`, `/auth/confirm` | staff | magic-link sign-in |
| `/setup` | school admins | 7-step setup wizard (resumes where you left off) |
| `/admin` | staff | items list; `/admin/items/new` intake; `/admin/claims` queue; `/admin/donate` ready to donate; `/admin/settings` |
| `/api/cron/retention` | Vercel Cron (`CRON_SECRET`) | daily photo retention job |
| `/invite/[token]` | staff | accept an invite |
| `/platform/schools` | platform admins (`PLATFORM_ADMIN_EMAILS`) | approve or reject new schools |

## Repository layout

```
apps/web            Next.js app (student gallery, setup wizard, staff view, server routes)
  src/lib/domain    Pure rules: categories, visibility, codes, search filter (unit-tested)
  src/lib/repo      Repository interface + PGlite and Supabase adapters (all database access)
  src/lib/server    Server-only glue: sessions, photos, rate limits, image pipeline
  src/lib/services  Search hook (searchItems) and claim decisions
  src/lib/demo      Demo school seed and SVG generator
  src/lib/auth      Auth interface, magic links, signed cookies
  src/lib/i18n      All user-facing strings
packages/           Shared packages (the matching engine will live in packages/matching)
supabase/
  migrations/       SQL schema, Row Level Security policies
  local/            Shims that let the migrations run locally in PGlite
  config.toml       Supabase CLI settings
apps/web/tests/db   Database tests (isolation, schema guard); run on PGlite or Supabase
apps/web/tests/repo Repository contract, run against both adapters
apps/web/tests/e2e  Playwright: full loop, privacy, wizard, accessibility
docs/               DECISIONS.md, AI_USAGE.md, DEPLOY.md, PILOT.md
```

## How the privacy rules work (for explaining the project)

**Visibility levels.** Every item is Full, Limited, or Staff-only. Students see
the photo and note only for Full items. Limited items show just the category,
color, place, and date. Staff-only items aren't listed at all. This is enforced
twice:

1. `toStudentView()` in `src/lib/domain/visibility.ts` builds the student
   version of an item field by field, so a private field can't slip through.
2. The database view `student_items` blanks out the photo and note for anything
   that isn't Full. Student pages only ever read from this view.

**Tenant isolation.** Each school's data has a `school_id`. Staff queries run
as a limited database role with Row Level Security, so a staff member at School A
gets zero rows from School B even if our app code had a bug. Students never
query the database; the server does it for them using the school id inside a
signed cookie, which they can't forge without the server's secret.

**Photos.** Every upload is decoded, rotated upright, and re-encoded on the
server (`src/lib/server/images.ts`), which drops all EXIF data including GPS
location. Photos are never public: browsers get short-lived signed links, and
students only for Full items. Face blur before upload is planned (SPEC T0.4)
but not built; there's a marked TODO in `src/components/photo-input.tsx`.

**Claims.** A student describes something only the owner would know (no names,
no IDs). They get a claim code to check the status; only a hash of it is
stored. Staff see the claim next to the item's private notes, verify in person,
and record the outcome. The app never marks anything returned on its own.
