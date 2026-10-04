# Deploying LostBox (Vercel + Supabase)

Production runs on **Vercel** with **`DATA_ADAPTER=supabase`**. PGlite is only for
local development, tests, and the offline demo. The app refuses to start on
Vercel with any other adapter (`src/lib/env.ts`), because PGlite keeps its data
on one machine's disk and Vercel requests can land on a fresh machine.

## 1. Supabase project

1. **Apply migrations** (from a machine that has run `supabase login` and `supabase link`):
   ```bash
   pnpm db:status   # 0001 should be applied; 0002 should be pending
   pnpm db:push     # applies 0002_mvp_support.sql
   ```
   `0002` adds the private `item-photos` Storage bucket, `items.staff_note`,
   `hit_rate_limit()`, `list_school_members()`, and the photo-folder check.
2. **Check the bucket** under Storage: `item-photos` should be **private**, with **no
   policies**. Only the server (secret key) reads and writes photos.
3. **Run the tests against a test project** (ideally a second, throwaway project with
   both migrations applied):
   ```bash
   # apps/web/.env.local: SUPABASE_TEST_DB_URL, SUPABASE_TEST_API_URL,
   #                      SUPABASE_TEST_PUBLISHABLE_KEY, SUPABASE_TEST_SECRET_KEY
   pnpm test:supabase
   ```
   This runs the database rules tests and the full repository contract (the same
   39 tests the PGlite adapter passes) against real Supabase Auth, PostgREST, and RLS.

## 2. Auth settings (magic links)

In the Supabase dashboard, under **Authentication**:

- **URL Configuration**
  - **Site URL:** your production URL, e.g. `https://lostbox.example.org`
  - **Redirect URLs:** add `https://lostbox.example.org/auth/confirm**`
    (and `http://localhost:3000/auth/confirm**` for local testing against Supabase).
- **SMTP: set up custom SMTP before the pilot.** Without it, Supabase's built-in
  email only sends to members of your Supabase team, and only about 2 emails an
  hour ([docs](https://supabase.com/docs/guides/auth/auth-smtp)). New free-tier
  projects also can't edit email templates unless custom SMTP is configured
  ([changelog](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)).
  After adding SMTP, raise the email rate limit under **Rate Limits** to something
  sensible for one school (e.g. 30/hour).
- **Magic link email template** (recommended, needs custom SMTP or a paid plan):
  ```html
  <h2>Sign in to LostBox</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
  <p>This link works once and expires soon. If you didn't ask for it, ignore this email.</p>
  ```
  Use the same link in the **Confirm signup** template (a first sign-in creates the
  account). With this template the link works on any device, e.g. requested on a
  laptop and opened on a phone.

  With Supabase's default template, sign-in still works, but only in the same
  browser that requested the link (Supabase's PKCE flow). `/auth/confirm` accepts
  both kinds of link.

The link opens a "Finish signing in" page with a button. The sign-in happens on
the button press, not on page load, so email security scanners that open links
can't use up the one-time link.

## 3. Vercel environment variables

Set these in Vercel → Project → Settings → Environment Variables. Tick **Production**
*and* **Preview**: pull requests deploy as Preview, and a Preview build without
them fails on purpose, listing every missing variable.

If a variable is missing, the build stops with a message like:

```
Vercel (preview environment) is missing settings:
  - DATA_ADAPTER=supabase (PGlite only works on a single machine)
  - SUPABASE_SECRET_KEY
```

| Variable | Value | Notes |
|---|---|---|
| `DATA_ADAPTER` | `supabase` | Required. The app refuses to start on Vercel without it. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Dashboard → Project Settings → API. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Safe to expose (RLS protects data). We don't actually send it to browsers: there is no browser Supabase client. |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **Server-only. Mark it Sensitive in Vercel.** Never prefix with `NEXT_PUBLIC_`. |
| `SESSION_SECRET` | 32+ random characters | Signs student and staff cookies. `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`. Changing it signs everyone out. |
| `APP_URL` | `https://lostbox.example.org` | **Production only.** No trailing slash. Used in magic links, invite links, and join links. Must match the Supabase Site URL. Leave it unset for Preview: previews then use their own branch URL. |
| `DEMO_MODE` | `false` | Or leave unset (production defaults to off). Never `true` on a real school's deployment. |
| `PLATFORM_ADMIN_EMAILS` | (optional) | Not used yet (the approval page is out of scope). |

Not needed on Vercel: `LOSTBOX_DATA_DIR`, `SUPABASE_TEST_*`.

Without `APP_URL`, production falls back to `VERCEL_PROJECT_PRODUCTION_URL` and
previews to `VERCEL_BRANCH_URL`.

**Previews and data.** Preview deployments run whatever code is in a pull
request. Point their Supabase variables at a **separate test project**, not the
pilot school's, so unmerged code never touches real data. For magic links to
work on previews, add `https://*-<your-vercel-team>.vercel.app/auth/confirm**`
to that project's Redirect URLs. If you'd rather not run previews at all, turn
them off under Vercel → Project → Settings → Git.

## 4. Approve the pilot school

New schools start as `pending_review` and students can't join them. With no
approval page yet, approve the pilot school in the Supabase SQL editor:

```sql
update public.schools
   set status = 'approved', reviewed_at = now(), reviewed_by_email = '<your email>'
 where slug = '<the school slug>';
```

## 5. Smoke test after deploying

1. Open `https://<APP_URL>/setup`, sign in with a real email, and check the link
   lands on `/auth/confirm` on **your domain** (not localhost).
2. Finish the wizard, approve the school (step 4), add an item with a photo.
3. In a private window on a phone: enter the join code, find the item, claim it.
4. Approve the claim, then mark it picked up.
5. Check `https://<APP_URL>/s/<slug>` returns `X-Robots-Tag: noindex`.

## 6. Photo retention job (daily)

Photos of resolved items (returned, donated, removed) are deleted after the
school's retention period (default 7 days). The item row stays, without a photo.
The job lives at `/api/cron/retention`, and `apps/web/vercel.json` schedules it
for **10:00 UTC every day** (about 2 to 3 a.m. in California).

- **`CRON_SECRET` (secret, Production only):** a random string of at least 16
  characters (`node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`).
  Mark it **Sensitive**. Vercel sends it as `Authorization: Bearer <CRON_SECRET>`
  when it calls the job; any other call gets `401`. If it's missing, the job
  answers `503` and does nothing, so photos are kept, not leaked.
- **Hobby plan limits** ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)):
  cron jobs can run at most once a day, and Vercel may run them any time within
  the scheduled hour. A daily job with a 7-day window doesn't need more.
- **Check it ran:** Vercel → Project → Settings → Cron Jobs shows each run and
  has a **Run** button. The response is just counts, e.g. `{"deleted":2,"failed":0}`.
  Each deletion is also in the school's audit log as `photo.deleted`.
- **Run it by hand** (e.g. locally): `curl -H "Authorization: Bearer $CRON_SECRET" <APP_URL>/api/cron/retention`.
- Cron jobs only run on production deployments, not previews.

## What CI checks before you deploy

- `check`: typecheck, lint, unit and database tests (PGlite).
- `secrets`: a production build with the Supabase adapter and fake secrets
  (Supabase key, session secret, cron secret), then a scan that fails if any of
  them appears in a file served to browsers.
- `e2e`: Playwright against a production build with the demo school (the full
  loop, privacy rules, wizard resume, and axe accessibility checks).
