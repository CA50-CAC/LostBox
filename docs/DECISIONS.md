# Decisions

One entry per non-trivial technical choice: the choice, what else was considered, why, and when.

---

### 2026-09-30: Local-first database with PGlite; Supabase for the real deployment

- **Choice:** Prototype uses PGlite (`@electric-sql/pglite`), Postgres compiled to WebAssembly, running inside Node and saving to `.data/`. The real deployment should use Supabase.
- **Alternatives:** local Supabase (needs Docker, not available on the dev machine); a hosted Supabase project now (no account yet); a JSON-file or in-memory store (simplest, but can't run our real SQL, RLS policies, or constraints).
- **Reason:** PGlite runs the same SQL migrations and Row Level Security policies as Supabase, so the tenant-isolation and visibility tests exercise the real rules, not a copy of them. A throwaway run on 2026-09-30 confirmed that the RLS policies, column grants, and CHECK constraints all behave correctly in PGlite. A small shim (`supabase/local/auth_shim.sql`) stands in for Supabase's `auth` schema and roles.
- **Known limits:** PGlite allows a single connection per data directory, so `pnpm seed:demo` must not run while `pnpm dev` is running (the in-app "Reset demo data" button covers that case). Uploaded photos are stored on local disk under `.data/uploads/`; Supabase Storage replaces that later.
- **To move to Supabase:** apply `supabase/migrations/*` (not the local shim), write a `supabase` adapter for `src/lib/repo/interface.ts` and an `AuthProvider` backed by Supabase Auth, and set `DATA_ADAPTER=supabase`.

### 2026-09-30: Monorepo layout from SPEC Section 8

- **Choice:** pnpm workspace with `apps/web` (Next.js) and `packages/*`. `supabase/` and `docs/` at the root.
- **Reason:** keeps the matching engine (`packages/matching`, written by the student later) separate from the app and reusable by the evaluation harness.

### 2026-09-30: Toolchain versions

- **Choice:** Node 24 LTS, pnpm 12, Next.js 16.3 (App Router), React 19.2, TypeScript 5.9, Tailwind 4, ESLint 9, Vitest 5, Zod 4.
- **Reason:** Next.js and TypeScript versions are what `create-next-app@16.3.7` installs, so they are known to work together. TypeScript 7 (the native port) is out but Next's template still uses 5.9.
- **Next.js 16 notes:** `middleware.ts` is now `proxy.ts`. We set `X-Robots-Tag: noindex` with `headers()` in `next.config.ts` instead of a proxy because it's simpler and static.

### 2026-09-30: Privacy enforced in the database, not just the UI

- **Choice:** Students are served from a `student_items` view that only returns available, non-staff-only items and blanks the photo path and note unless the item is Full. Application code also projects items through `toStudentView()`.
- **Alternatives:** filter only in application code.
- **Reason:** CLAUDE.md requires enforcement "on the server and in the database access layer." Two independent guards mean one bug doesn't leak a photo.

### 2026-09-30: Composite foreign keys for tenant integrity

- **Choice:** `locations`, `items` have `unique (school_id, id)`, and child rows reference `(school_id, id)`.
- **Reason:** makes it impossible at the database level for an item to point at another school's location, or a claim at another school's item.

### 2026-09-30: Join code and claim code format

- **Choice:** 8-character join codes and 10-character claim codes from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L), generated with rejection sampling from `crypto.getRandomValues`. Claim codes and invite tokens are stored only as SHA-256 hashes.
- **Note:** the demo school's fixed code `DEMO2026` contains `0` and `O`. That's fine: it's documented and fixed, and code input is only uppercased, never "corrected."

### 2026-09-30: Accent color

- **Choice:** teal (`#0f766e` light, `#5eead4` dark). Student had no preference.
- **Reason:** calm, not "alert" colored, and passes WCAG AA on both themes (5.47:1 light, 12.77:1 dark, measured).

### 2026-09-30: Hosted Supabase project, alongside PGlite

- **Choice:** The team now has a hosted Supabase project. It's used when `DATA_ADAPTER=supabase`. PGlite stays the default for tests, CI, and the offline demo.
- **Alternatives:** replace PGlite with Supabase everywhere (tests and CI would then need network access and secrets, and the demo would no longer run with "no external services beyond the local DB").
- **Details:**
  - Keys use Supabase's newer format: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, safe to expose; RLS protects the data) replaces the old anon key, and `SUPABASE_SECRET_KEY` (`sb_secret_…`, server-only) replaces the service-role key.
  - No browser Supabase client. Students never touch the database, and staff screens go through server code, so the database is only reachable through code we control.
  - `src/proxy.ts` refreshes the staff session on each request (Next 16 renamed middleware to proxy). It calls `supabase.auth.getClaims()`, which is what actually triggers the refresh, and copies the cache-control headers `@supabase/ssr` 0.12 passes to `setAll`. Supabase's dashboard quickstart snippet does neither.
- **Migrations:** applied to the hosted project with the Supabase CLI, not by pasting into the SQL editor, so the hosted database can't drift from `supabase/migrations/`. The repo had no migration runner yet to reuse. PGlite reads the same files.

### 2026-09-30: Database tests run on PGlite and, on demand, on hosted Supabase

- **Problem:** PGlite doesn't have Supabase's `auth` schema, roles, or default privileges. The shim fakes them, so the local tests could pass while production behaves differently.
- **Choice:**
  1. The shim now copies Supabase's default privileges (new objects in `public` are granted to `anon` and `authenticated`). Local is now at least as open as production, never more locked down.
  2. A schema guard test (`tests/db/schema-guard.test.ts`) checks the catalog: every table has RLS on, `anon` can touch nothing, and `authenticated` has exactly the listed privileges and functions.
  3. The isolation test (`tests/db/isolation.test.ts`) works at the SQL level, so the same file runs on PGlite (default, CI) or the hosted project (`pnpm test:supabase`, opt-in, separate `SUPABASE_TEST_*` env vars).
- **It found a real bug:** with Supabase's defaults copied in, the guard showed `anon` could use the `audit_log` ID sequence, because `0001_init.sql` revoked tables and functions but not sequences. Fixed before the migration was ever applied.
- **Checked the tests catch problems:** temporarily setting the items policy to `using (true)` and removing the sequence revoke made both tests fail.
- **Still not covered:** how Supabase turns a login token into a database identity (we set the same setting by hand in tests), and Storage policies (photos are on local disk for now). Both will be covered by adapter-level tests when the Supabase adapter and Storage exist.
- **Dependencies:** `postgres` (postgres.js, dev only, no dependencies of its own) for the direct connection in `pnpm test:supabase`; `@electric-sql/pglite` (already chosen above); `supabase` CLI (dev only).

### 2026-09-30: Trust rules inside a school, enforced in the database

Found while reviewing `0001_init.sql` before its first push. Fixed in `0001` itself because it had never been applied.

- **A school always keeps an owner.** A trigger (`keep_an_owner`) rejects any delete or role change that would leave a school with no owner. Deleting the whole school still works. Side effect: a user who is the only owner of a school can't be deleted from Supabase Auth until another owner exists.
- **Join codes come only from the database.** `generate_join_code()` (same alphabet as `codes.ts`, rejection sampling over `gen_random_uuid()` bytes) is called by `create_school` and the new owner-only `rotate_join_code`, which also writes to the audit log. Owners can no longer update `join_code` directly. The TypeScript `generateJoinCode` was removed so there's one generator, and a test checks the database uses the TypeScript alphabet.
- **Records say who really did it.** `items.created_by` and `staff_invites.created_by` default to `auth.uid()` and RLS rejects any other value. Claim review fields are set by a trigger (`stamp_claim_review`) when the status changes; staff can only update `status`. Invites can't be edited (revoke and resend).
- **No direct membership inserts.** Members only join through `create_school` (founder) or `accept_staff_invite` (an invite sent by an owner to that email). Promoting staff to owner has no path yet; it would need its own owner-only function.
- **Alternative considered for claims:** a policy check `reviewed_by = auth.uid()`, like `audit_log`. Rejected because it would block a second staff member from marking an already-approved claim as picked up.
- **Verified:** undoing each fix makes at least one test fail (6 failures in total).

### 2026-09-30: The app is named LostBox

- **Choice:** LostBox replaces the working title Boomerang everywhere: the app name string (`app.name` in `en.ts`), the package names (`lostbox`, `@lostbox/web`), the local Supabase `project_id`, and the README, `SPEC.md`, and `CLAUDE.md` titles.
- **Not changed:** the header comment in `supabase/migrations/0001_init.sql` still says Boomerang. That file is already applied to the hosted project and is marked "don't edit".

### 2026-10-01: Repository adapters and one shared contract test

- **Choice:** `src/lib/repo/pglite.ts` and `src/lib/repo/supabase.ts` both implement `repo/interface.ts`. One test suite (`tests/repo/contract.ts`, 39 tests) runs against PGlite in CI and against a hosted project with `pnpm test:supabase`.
- **Interface changes:** `forStaff(userId)` became `forStaff({ userId, accessToken })`, because on Supabase the database learns who is asking from the login token, not from an id we pass. Expected failures are thrown as `RepoError` with a code (`not_found`, `conflict`, `forbidden`, `invalid`) so both adapters fail the same way. Added `getClaim`, `Member.createdAt`, and `StaffItem.staffNote`.
- **Who runs as whom:** staff calls run as `authenticated` with RLS (PGlite switches role inside a transaction; Supabase sends the user's token with the publishable key). Student, platform, and system calls run as the database owner / secret key, so every student query filters by the school id from the signed session and reads only `student_items`.
- **Supabase adapter limits:** Supabase's API has no multi-statement transactions, so `saveLocations` and `setItemStatus` are several calls in a row. A failure halfway leaves a partial change (for example, locations saved but links not). Acceptable for now; a database function would fix it if it ever matters.
- **Checked the tests catch problems:** removing the school filter from a student query, or adding `photoUrl`/`note` keys to Limited items, made 4 contract tests fail.
- **Not yet run:** the contract on hosted Supabase. It needs a test project with `0002` applied and `SUPABASE_TEST_PUBLISHABLE_KEY` set.

### 2026-10-01: Migration 0002 (staff notes, rate limits, member emails, photo bucket)

- **`items.staff_note`** for private notes. `owner_hint` wasn't reused because any value in it shows students a "has a name label" badge, which would reveal that a private note exists.
- **`photo_in_school_folder`** check: a photo path must start with the item's own school id. Staff can update items directly through Supabase's API, so without it someone could point an item at another school's photo. Added `NOT VALID` so existing rows aren't re-checked.
- **`hit_rate_limit()`** does "count and check" in one statement. A read-then-write from the app through the API would let two simultaneous requests both pass. Server only (revoked from `anon` and `authenticated`).
- **`list_school_members()`**: on Supabase, signed-in users can't read `auth.users`, so this `security definer` function returns emails only for schools the caller belongs to.
- **Photo bucket `item-photos`:** private, with no Storage policies at all. Only the server (secret key) reads and writes photos; browsers get short-lived signed URLs, and students only for Full items. Created by the migration only where a `storage` schema exists, so PGlite skips it.
- **Alternatives:** Storage RLS policies so staff upload straight from the browser. Rejected because EXIF must be stripped on the server before storage anyway.

### 2026-10-01: Staff sign-in flow

- **Choice:** Magic links behind `AuthProvider`. Locally (PGlite), our own one-time tokens (hashed in `auth.magic_links`, 15 minutes, single use) and a signed `lb_staff` cookie; the link is shown on screen, and only in development or demo mode. On Supabase, `signInWithOtp` sends the email and `@supabase/ssr` keeps the session; `src/proxy.ts` refreshes it.
- **Sign-in happens on a button press** at `/auth/confirm`, not when the link opens. Some school email systems open every link to scan it, which would use up a one-time link.
- **Both Supabase link styles work:** `token_hash` (our recommended template; any device) and `code` (Supabase's default template; same browser only). See `docs/DEPLOY.md`.
- **The proxy redirects signed-out visitors** away from `/admin` and `/setup/2-7`, but it isn't the security boundary: every page and action calls `requireStaff()`, and RLS checks again.
- **Alternatives:** Supabase Auth locally too (needs Docker or network); passwords (CLAUDE.md says no).

### 2026-10-01: Student sessions and the school id

- **Choice:** Joining sets a signed `lb_student` cookie with the school id and slug (30 days). Student pages read the school only from it; the slug in the URL must match but never chooses the school. Pending schools' codes answer "not found", the same as a wrong code.

### 2026-10-01: Photos

- **Choice:** sharp on the server decodes, rotates, re-encodes to JPEG (max 1600px), which drops all metadata. The browser also shrinks photos first, because Vercel caps request bodies at 4.5MB; the server never trusts that step.
- **Storage:** private Supabase bucket in production; `.data/uploads` locally, served by `/api/photos` only with an HMAC-signed, expiring URL. SVGs are only ever our own generated demo pictures (uploads are always re-encoded to JPEG) and are served with a sandboxing CSP.
- **Face blur:** not built (out of scope); a marked TODO sits in `photo-input.tsx` where on-device blur belongs. Not faked.
- **Dependency:** `sharp` (already installed by Next.js for image optimization; now listed explicitly).

### 2026-10-01: Staff invites show a link instead of emailing

- **Choice:** Owners create an invite and get a one-time link to send themselves (only its hash is stored). There's no email service in scope, and Supabase's built-in email can't reach arbitrary addresses. The invitee signs in with the invited email and accepts; `accept_staff_invite` checks the email matches.

### 2026-10-01: Claim decisions change the item too

- **Choice:** `decideClaim()` (`src/lib/services/claims.ts`): approve → claim approved and item `claimed` (off the gallery); reject → item back to `available` if no other approved claim; picked up → claim `picked_up` and item `returned`. Several calls in a row rather than one transaction (see the adapter note above).

### 2026-10-01: Demo school

- **Choice:** `seedDemo()` deletes and rebuilds Demo High School with a fixed id, so student cookies survive a reset. Demo donate-after is 21 days so the "older than donate-after" items fit inside "the last 30 days". `DEMO_MODE` defaults on only for PGlite in development; production needs `DEMO_MODE=true` explicitly.

### 2026-10-01: Testing in a browser

- **Choice:** Playwright and `@axe-core/playwright` (dev only) for end-to-end and accessibility checks against a production build, with the demo seeded into `.data-e2e/`. A new CI job runs them. Another CI job builds with the Supabase adapter and a fake secret, then fails if the secret appears in browser files.
- **`tsx`** (dev only) runs `scripts/seed-demo.ts` with the `@/` import paths. pnpm's `allowBuilds` now lists `esbuild: false` (its install script only re-checks the prebuilt binary).

### 2026-10-01: Design pass (cards on a soft background)

- **Choice:** The page background is a soft off-white and content sits on white `card`s (a Tailwind `@utility` in `globals.css`) with a hairline border and soft shadow; dark mode mirrors it. One accent color is kept. New tokens (`card`) are added to the contrast test.
- **Gallery categories:** quick-filter chips are submit buttons in the search form (`name="pick"`), not links, so they work without JavaScript and keep the search text and other filters.
- **Alternatives:** a component library (shadcn/ui, Radix). Rejected: a new dependency for styling we already have, and more code the student has to explain.

### 2026-10-03: Phone-first app shell

- **Choice:** On phones, students and staff get a bottom tab bar like a native app (`components/tab-bar.tsx`): students have Browse, My claim, and Pickup (a new `/s/[slug]/info` page that took over the old footer's pickup details and "different school" link); staff have Items, a raised Add button, Claims (with a pending count), and Settings. Wider screens show the same tabs as top pills. The student item screen hides the tab bar, runs the picture edge to edge, and keeps "This might be mine" in a fixed bar at the bottom. The gallery search is one field with a filters button that opens a panel (a `<details>`, so it still works without JavaScript).
- **Why:** Students will almost always open LostBox from a QR poster on their phone, so the main actions should sit where the thumb is.
- **Alternatives:** an installable PWA with a manifest and service worker. Not now: more to explain and test, and nothing needs to work offline.

### 2026-10-01: Out of scope, as agreed

AI matching, auto-fill, auto-blur, notifications, analytics, lost-item reports, logo upload, and location "nearby" links UI.





### 2026-10-04: Production readiness

- **Platform approval page:** `/platform/schools` lists schools by status (waiting, approved, rejected) with Approve, Reject, and "move back to waiting". Only emails in `PLATFORM_ADMIN_EMAILS` can open it; everyone else gets a 404 rather than "forbidden", so the page doesn't advertise itself. The rule lives in `services/schools.ts` (`reviewSchool`) and is checked again there, not only by the page. It uses the existing `platform()` repository, so no schema change. This replaces the "approve with SQL" step in DEPLOY.md.
- **SMTP provider: Resend**, with Brevo as the fallback for anyone without a domain. Resend's free tier (3,000 a month, 100 a day) is about 20 times one school's staff sign-ins, it documents Supabase setup, and its SMTP password is a revocable, send-only API key. The Supabase auth email rate limit is set to 20 an hour so a runaway loop stays under the provider's daily cap. Alternatives: SendGrid (no lasting free tier now), Amazon SES (needs a paid AWS account and sandbox exit), Supabase's built-in email (2 an hour, team members only).
- **`pnpm smoke <url>`:** read-only HTTP checks after each deploy (public pages, anonymous visitors bounced from staff pages, `noindex`, no secret-looking strings in HTML). It changes nothing, so it's safe against production. Sign-in, email, and the claim loop stay a short manual checklist, because they need a real inbox.
- **`pnpm db:push:dry`:** `supabase db push --dry-run`, so the exact migrations are listed before anything is applied.

### 2026-10-04: Photo retention job and "Ready to donate"

- **Retention:** a daily Vercel Cron call to `/api/cron/retention` (10:00 UTC). It lists photos past each school's retention period (`listExpiredPhotos`), deletes the file (Supabase Storage, or `.data/uploads` locally), then clears the path (`clearPhoto`, which now also writes a `photo.deleted` audit entry with no actor). File first, database second, so a failed delete is retried the next day instead of leaving an orphan. The route needs `Authorization: Bearer <CRON_SECRET>` (compared in constant time); without `CRON_SECRET` set it refuses everything (503) rather than running open. The secret scan in CI now checks the session and cron secrets too.
- **Contact emails on closed claims** are cleared by the same job, after the same period (`clearClosedClaimContacts`), as the schema comment on `claims.contact_email` always intended. Claim text and status stay, so the school keeps its record.
- **Why daily:** Vercel Hobby allows cron at most once a day, with timing anywhere in the hour. A 7-day retention window doesn't need more. Alternatives: Supabase `pg_cron` (can't delete Storage files from SQL safely), a GitHub Actions schedule (another place to keep the secret).
- **Supabase Storage deletes now report errors.** Before, a failed delete was silent. The item edit page still ignores them (it's cleanup of a file nothing points at), but the retention job counts them as failed and retries.
- **Ready to donate** (`/admin/donate`): available items found more than the school's donate-after days ago, oldest first. Items with a pending claim are held back (a student is waiting on them) and counted in a note. Staff tick items or "select all", press "Mark N donated", and confirm inline. The server recomputes the list and refuses the whole batch if any id isn't on it, so a stale page or a tampered form can't donate a claimed item or another school's item. Each item gets an `item.donated` audit entry (existing `setItemStatus`). Any staff member can do it, the same as changing an item's status. No schema change.

### 2026-10-04: Privacy page and pilot kit

- **`/privacy`:** public, plain English, every string through `t()`. It covers what LostBox keeps (items, claims, hashed claim codes, staff emails, school settings, cookies, hashed rate-limit counters), what it never collects, how photos are used (the three visibility levels, wallets never Full, expiring photo links), who can see staff-only information, and retention. Each statement was checked against the code; if a rule changes, the page changes with it. It also says plainly that the people running LostBox can reach the database for maintenance.
- **Links:** a small "Privacy" link at the bottom of the student shell, staff shell, setup wizard, sign-in pages, and home page, plus a row on the student Pickup tab. One shared component (`components/privacy-link.tsx`).
- **`docs/PILOT.md`:** what LostBox does and collects, the daily staff workflow with time estimates (labelled as estimates; the survey measures the real number), a 10-minute walkthrough, a 3-question survey, and a pre-pilot checklist.
### 2026-10-04: Search evaluation harness (`eval/`)

- **What's built:** the manifest format (validated with zod), an item-level dev/test split, the metrics (Recall@1/3/5, MRR, median rank, found), two baselines, a results table, and saving of aggregate results stamped with the date and commit. **Not built:** the ranking algorithm. `apps/web/src/lib/services/match.ts` is a clearly marked stub with exactly the `searchItems` signature (a type test enforces it); the harness reports it as "not implemented" until the student writes it.
- **Same code as the app:** B1 imports the app's real `searchItems`, and every system gets a student data layer (`memoryStudentRepo`) shaped like `forStudent()`. So the numbers measured are the numbers shipped (SPEC 7.4).
- **Split by hashing each item id with a fixed seed**, not by shuffling: adding items never moves old ones between dev and test, and all of an item's queries stay on one side.
- **Misses count as last.** Median rank is "not found" if more than half the queries miss, and a separate "found" column shows how often a filter hides the right item entirely. That's B1's real weakness, so it should be visible, not averaged away.
- **Privacy:** photos, the manifest (owners' words), and per-query details are git-ignored (`eval/.gitignore`). Saved results hold counts and metrics only. The test fixture is synthetic.
- **A workspace package** (`@lostbox/eval`, added to `pnpm-workspace.yaml`) with its own tests and typecheck, so `pnpm test` and CI cover it. It reaches the app's code through the `@/` path alias, not a copy.
### 2026-10-04: Impact dashboard

- **`/admin/stats`** shows, for a chosen period: items logged, items returned, return rate, median time from logging to return, items donated; and, for today: items waiting and claims pending. Presets (7, 30, 90 days, school year from August 1, all time) and a custom from/to in the school's time zone, with daylight saving handled.
- **No new data or migration.** Everything comes from columns we already had: `items.created_at` (logged), `items.status` + `resolved_at` (returned, donated), and `claims.status`. Computed in memory from the staff data layer (`services/stats.ts`, pure functions, RLS applies); fine at pilot scale (hundreds of items). Only counts and durations reach the page: no notes, names, or claim text.
- **Definitions chosen to be honest in a write-up:** return rate is a cohort (of the items logged in the period, how many are now returned), so it can't go over 100% and doesn't credit this month for last month's items. The median, not the mean, for time to return, so one item that sat for a month doesn't swamp a week of same-day returns. The definitions are on the page under "How these are counted".
- **Chart:** one series (returns per week) as HTML columns, not a chart library: crisp at phone width, keyboard-reachable values, a table view, and the app's accent color (contrast checked against both themes' card colors). Return rate is the one "hero" number; the rest are plain tiles.
- **Demo history:** the seed adds 9 returned items (with picked-up claims) and 2 donated items over the last month, so the dashboard isn't empty in a demo. They're resolved (never shown to students) and have no photos.
- **Navigation:** staff now have five tabs: Items, Claims, a raised Add in the middle, Impact, Settings. On tablet widths the top tabs show icons only (labels stay for screen readers and tooltips).
### 2026-10-04: QR codes and the print poster

- **QR library: `uqr`** (MIT, no dependencies, maintained by the UnJS group). It only turns text into a grid; `lib/qr.ts` draws the grid as one black-on-white SVG path with the 4-square quiet zone scanners need, and error correction level M (survives about 15% damage, good for a poster on a wall). Alternatives: `qrcode` (pulls in `yargs` and `pngjs` for its CLI and PNG output, which we don't use), an online QR API (sends the join link to a third party, and breaks offline).
- **Always the current code.** The launch screen and settings show `<img src="/admin/join-qr?v=CODE">`. The route is staff-only and draws from the join code *in the database*; `?v=` is only a cache buster, so even a stale page can't show an old code's QR. The poster reads the database on every request too. A test rotates the code and checks the QR and poster follow it.
- **Poster at `/s/[slug]/poster`:** staff of that school only (others get the sign-in page or a 404). It sits next to the student pages, so the student pages moved into a `(student)` route group (URLs unchanged) to keep their join-code layout off the poster. One US Letter page via `@page { size: letter; margin: 0.5in }`; print hides the toolbar and demo banner. The sheet is pure black on white in both themes. No PDF library: the browser's "Print / Save as PDF" does it.

### 2026-10-06: "Campus Bright" look and a light/dark switch

- **Choice:** a new visual direction the student specified: Plus Jakarta Sans (headlines 800 weight with -0.03em tracking), white page, navy text, one cobalt accent (`#2f5bea` light, `#6e8eff` dark), and a small yellow highlight (`#ffd23f`) for badges only. Dark mode is navy (`#0b1424`), not black. Panels are flat tinted fills (`card`) with no shadows or gradient glow. Shapes: 14px inputs and buttons, 20px panels, 12px icon tiles, set once by remapping Tailwind's radius scale in `globals.css`. This replaces the teal accent (2026-09-30) and the shadowed white cards (2026-10-01). Visual only: no routes, data, or security behavior changed.
- **Three border tokens.** `border` (dividers) and `border-tint` (decorative panel and chip edges) use the student's colors. Form fields get their own `border-input` (`#7483b8` light, `#6f82b5` dark) because the colors given for inputs measured about 1.5:1, and a field's outline is how you find it (WCAG 1.4.11 asks for 3:1). Measured: 3.70:1 and 3.42:1 light (on page, on panel), 4.86:1 and 4.27:1 dark.
- **Measured, not eyeballed.** `contrast.test.ts` checks every text/background pair at 4.5:1 and the field outline at 3:1 in both themes. Tightest pair: accent on accent-soft (4.67:1 light, 4.61:1 dark), so neither color can get lighter without failing the test. Status colors were picked to fit: danger `#b3261e` / `#ff8f87`, success `#12683a` / `#5bd896`, warning `#8a4a00` / `#ffd23f`.
- **Codes use the same font.** Join codes and claim codes were in Geist Mono; they are now Plus Jakarta Sans 800 with wide letter-spacing and tabular numbers (the `code-text` utility). One font file instead of three. The code alphabet already leaves out look-alike characters.
- **Theme switch: System (default), Light, Dark, stored in a cookie.** The root layout reads the `lb_theme` cookie on the server and puts `data-theme` on `<html>`, so the first HTML is already the right theme. "System" sets no attribute and a `prefers-color-scheme` media query picks. The `theme-color` meta tag follows the same choice. A test fetches the raw HTML with the cookie and checks the attribute is there.
  - **Alternatives:** `localStorage` plus an inline script (the usual way; needs a script that runs before paint, and the server still sends the wrong theme first), or a theme library such as `next-themes` (a dependency for about 60 lines of our own code).
  - **Cost:** reading a cookie in the root layout means every page is rendered per request. Almost all of them already were (they read a session); `/privacy` and `/login` lose static caching.
  - **Dark values are written twice** in `globals.css` (once in the media query for System, once for `[data-theme="dark"]`) because CSS can't share them. `light-dark()` would avoid that but is too new for older school iPads. The contrast test fails if the two copies differ.
  - **The cookie** holds one of three words, is `HttpOnly`, `SameSite=Lax`, lasts a year, and anything unexpected is treated as System. It's a display preference, not personal data; the privacy page's cookie sentence now mentions it.
- **The control** is a real radio group in a form (`components/theme-toggle.tsx`): arrow keys work, screen readers announce the selected option, and without JavaScript a "Save theme" button submits it. It's on the student Pickup tab, staff Settings, and as a compact icon version in both headers on wider screens. No theme transition, so nothing to turn off for reduced motion.
- **Demo illustrations** keep their own pale backdrop (slightly deeper than the panels) so they read as photos on both themes.
