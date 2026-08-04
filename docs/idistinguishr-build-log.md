# IDistinguishR — Build Log

Chronological record of what's actually been done in the repo, post-planning.
The planning docs (data model, user stories, stack decision, etc.) describe
what we're building and why; this doc tracks what's been *set up and built*
so far, in the order it happened. Update it as work continues — it's meant
to be the fastest way to answer "where did we leave off?"

---

## 1. Environment setup

- `npm install` — 355 packages, clean install, 0 errors.
- npm's `allow-scripts` security feature blocked postinstall scripts for
  `prisma`, `@prisma/client`, `sharp`, and `esbuild`. Not an issue in
  practice — `prisma migrate dev` runs `generate` explicitly anyway (see
  below), so the client still gets built. Flagging in case `sharp`/`esbuild`
  cause issues later if something depends on their install-time build step.
- `npm audit` reported 3 high-severity advisories in transitive deps.
  Not addressed — `npm audit fix --force` tends to bump majors and break
  things, and nothing about the advisories was urgent for local dev.

## 2. Database — Neon Postgres

Chose Neon over Supabase and over a local Docker Postgres (see
`idistinguishr-db-hosting-decision.md` for the reasoning — no local
Postgres/Docker was installed on this machine, and Neon's scale-to-zero
suits a project worked on in bursts).

- Created a Neon project (`idistinguishr`, region `eu-west-2`).
- `.env` created from `.env.example` with `DATABASE_URL` filled in
  (gitignored, never committed — connection string was shared once in
  chat and written straight to the local file).
- Postgres 18 — confirmed nothing in the schema is version-sensitive
  (uuid PKs, arrays, decimals, enums), so no compatibility concerns.

## 3. Auth secret

`npx auth secret` pulled in an unrelated `auth` CLI package (outputs
`BETTER_AUTH_SECRET`, meant for the `better-auth` library, not
NextAuth/Auth.js). Generated the secret directly instead:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Written to `AUTH_SECRET` in `.env`.

## 4. Prisma migration

```bash
npx prisma migrate dev --name init
```

Applied cleanly against Neon — migration
`prisma/migrations/20260804153647_init/`. Prisma Client generated
(`@prisma/client` v6.19.3) despite the blocked postinstall script, since
`migrate dev` runs `generate` as part of its own flow.

Known gap, not yet addressed: the schema comment in `prisma/schema.prisma`
notes that double-booking prevention needs a partial unique index
(`CREATE UNIQUE INDEX ... WHERE status != 'CANCELLED'`) added via raw SQL,
since Prisma can't express partial indexes declaratively. Deferred to the
booking-flow step (step 4 in the README's build order), where it's
actually load-bearing.

## 5. Dev server

`npm run dev` — Next.js 15.5.22, ready in ~4s, confirmed responding
(`200`) at `http://localhost:3000`.

## 6. Auth — minimal signup/login UI

The README's build order puts Auth before teacher profiles, and the
`/auth` page was still a stub with no way to actually sign up or log in —
which blocks testing anything gated by role. Built the minimum needed to
unblock that:

- **`src/lib/auth.ts`** — added `jwt`/`session` callbacks so
  `session.user` carries `id` and `role` (needed for role-based routing
  and for gating API routes). `authorize()` now returns `role` too.
- **`src/types/next-auth.d.ts`** — module augmentation adding `id`/`role`
  to `Session`/`User`/`JWT`. One gotcha: `next-auth/jwt` re-exports `JWT`
  from `@auth/core/jwt` via `export *`, which doesn't merge with
  `declare module "next-auth/jwt"` — had to augment `@auth/core/jwt`
  directly instead, or the fields type as `unknown`.
- **`src/app/api/auth/signup/route.ts`** — new endpoint: validates with
  Zod, checks for an existing email, hashes the password (bcrypt, 12
  rounds), creates the `User` row with the chosen role.
- **`src/app/auth/AuthForm.tsx`** + **`src/app/auth/page.tsx`** —
  sign up / log in toggle, role picker on signup, credentials sign-in via
  `next-auth/react`, redirects to `/teacher/profile` (teacher) or
  `/dashboard` (student) after success.
- **`src/app/post-auth/page.tsx`** — landing spot for the Google OAuth
  redirect (can't run client-side routing logic mid-OAuth-flow), does the
  same role-based redirect server-side.
- **`src/components/NavBar.tsx`** + **`SignOutButton.tsx`** — top nav,
  server-rendered, shows role-appropriate links + sign out when logged in.

**Known gap, deliberately not fixed:** Google OAuth is configured
(`Google` provider in `auth.ts`) but not functional — the Prisma schema
has no `Account`/`Session`/`VerificationToken` models, which
`@auth/prisma-adapter` requires for OAuth account linking, and `User` has
no `name`/`image`/`emailVerified` fields for the adapter to write to.
Since Google credentials aren't in `.env` yet either, this doesn't bite
today — the `/auth` page only renders the Google button when
`GOOGLE_CLIENT_ID` is set. Fix the schema (add those three models + the
missing `User` fields, or a custom adapter mapping) before wiring up real
Google credentials.

## 7. Teacher profile CRUD — US-25

- **`src/app/api/teacher/profile/route.ts`** — `GET` (fetch own profile)
  and `PUT` (create-or-update via `upsert` on `userId`, since
  `TeacherProfile` is 1:1 with a teacher `User`). Zod schema validates
  bio/instrument/rate/credentials bounds and requires a location when
  `IN_PERSON` is offered. Rate is submitted in pounds, stored as pence
  (`hourlyRateMinorUnits`).
- **`src/app/teacher/profile/page.tsx`** (server) — gates on
  session + `role === TEACHER`, fetches the existing profile, redirects
  to `/dashboard` for non-teachers and `/auth` for anonymous users.
- **`src/app/teacher/profile/TeacherProfileForm.tsx`** (client) —
  the actual form: bio, instruments (comma-separated), hourly rate,
  format checkboxes, conditional location field, credentials, and an
  approval-status badge (pending/approved/rejected).

## 8. Availability CRUD — US-26

- **`src/lib/require-teacher-profile.ts`** — shared helper used by all
  the availability routes: resolves the signed-in teacher's own
  `TeacherProfile`, or `null` if unauthenticated/wrong role.
- **`src/app/api/teacher/availability/rules/route.ts`** (`GET`/`POST`)
  and **`rules/[id]/route.ts`** (`DELETE`) — weekly recurring hours.
  `POST` rejects overlapping slots on the same day (409). Editing is
  delete-then-recreate rather than `PATCH` — matches the add/remove chip
  UI and avoids partial-update validation complexity.
- **`src/app/api/teacher/availability/exceptions/route.ts`**
  (`GET`/`POST`) and **`exceptions/[id]/route.ts`** (`DELETE`) — one-off
  blocked/added dates, optionally scoped to a time range (null start/end
  = all day).
- All mutation routes check row ownership (`teacherId === profile.id`),
  not just existence — verified a second teacher account gets `404`
  trying to delete another teacher's rule, not just `401`.
- **`src/app/teacher/availability/page.tsx`** (server) — same auth
  gating as the profile page, plus a redirect to `/teacher/profile` if
  the teacher hasn't created a profile yet (availability hangs off it).
- **`src/app/teacher/availability/AvailabilityManager.tsx`** (client) —
  two sections (weekly hours, exceptions), each with an add form and a
  list of removable chips.

## 9. Styling

Ported a working subset of `idistinguishr-style-guide.html` into
`src/app/globals.css` — buttons (`btn-primary`/`secondary`/`ghost`), form
fields, cards, badges (including approval-status variants), the nav bar,
the staff-line divider, and typography helpers (`eyebrow`, `t-display-*`,
`t-soft`). Not a 1:1 port of the whole style guide (swatches/type
specimens are guide-only) — just what the built pages actually use so
far; extend as more screens get built.

## 10. Testing performed

**API (curl, with real cookies/CSRF against the running dev server):**
- Signup → credentials sign-in → session includes `id`/`role`.
- Profile `PUT` (create) → `GET` round-trips correctly, pence conversion
  verified (£35 → 3500).
- Availability rule `POST` — overlap rejected (409), invalid
  end-before-start rejected (400).
- Exception `POST`/`GET` round-trip with date serialization.
- Cross-account authorization: a second teacher account gets `401`
  (no profile yet) and then `404` (has a profile, but doesn't own the
  row) trying to delete the first teacher's data.

**Browser (Claude in Chrome, against the same dev server):**
- Signed up as a teacher through the actual `/auth` form → redirected to
  `/teacher/profile`.
- Filled out and submitted the profile form → "Pending approval" badge
  appeared, form flipped to "Save changes" on refresh.
- Added a weekly-hours slot on `/teacher/availability`, confirmed the
  chip appeared; removed it, confirmed it disappeared.
- Signed out via the nav bar → confirmed redirect to `/` and nav
  reverting to "Log in".
- All test users/profiles/availability rows created during testing were
  deleted from the Neon DB afterward.

## 11. Git

- `.gitignore` updated to add `next-env.d.ts` and `*.tsbuildinfo`
  (standard Next.js build artifacts the original `.gitignore` was
  missing).
- Committed as `db194f8` — "Add minimal auth UI and teacher
  profile/availability CRUD" (25 files changed). Includes the initial
  Prisma migration, `package-lock.json` (first lockfile committed in this
  repo), and `idistinguishr-db-hosting-decision.md`.
- Pushed to `origin/main`.

---

## 12. Search/results with filtering, plus the public Teacher Profile screen — US-01 through US-08

The README's step 3 is "Search/results with filtering," which maps to the
Homepage and Results screens. Bundled in the public Teacher Profile screen
too (not its own numbered step, but Results' "View Profile" links need
somewhere to go, and the availability-preview logic it needs is shared
with Results' availability filter) — confirmed with the user before
starting.

- **`src/lib/availability.ts`** — new: `getUpcomingAvailability(teacherId, days)`
  computes open time windows for the next N days by applying
  `AvailabilityException` on top of the recurring `AvailabilityRule`
  pattern, per the data model doc's "compute at request time, don't
  pre-generate slot rows" note. Doesn't subtract existing bookings yet
  (Booking doesn't exist as a concept until the booking-flow step) and
  drops a whole rule-window on a partial `BLOCKED` overlap rather than
  splitting it — good enough for a preview/filter, not precise enough for
  actual slot selection, which the booking step will need to handle
  properly.
- **`src/lib/teacher-search.ts`** — new: `BOOKABLE_WHERE` (the
  `approvalStatus: APPROVED && stripeOnboardingComplete: true` gate from
  the data model doc), `searchTeachers()` (filter/sort/paginate),
  `getInstrumentOptions()` (distinct instruments across bookable
  teachers, derived at request time — there's no separate Instruments
  table per the data model's MVP decision), `getFeaturedTeachers()`.
  Availability-dependent sort (`soonest`) and filter (`availableThisWeek`)
  aren't DB columns, so those pull a capped 100-teacher candidate pool and
  compute in JS rather than querying the whole table — noted in comments
  as an MVP-scale shortcut, not something that scales indefinitely.
- **`src/app/page.tsx`** (Homepage) — search form (instrument required,
  location/online optional) posting a plain GET to `/results`; top-rated
  teachers section. No client JS needed — it's a real HTML form, so
  results stay bookmarkable per the US-01 AC.
- **`src/app/results/page.tsx`** (Results) — two plain GET forms (top
  search bar; sidebar filters + sort), all state read from
  `searchParams`. Filters: format, price range, minimum rating,
  "available this week". Sort: relevance (proxied by rating, no real
  relevance engine exists), price, rating, soonest available. Simple
  prev/next pagination, 12 per page. Empty state per US-05.
- **`src/app/teachers/[id]/page.tsx`** (Teacher Profile) — bio,
  credentials (split on newlines into a list, since the field is
  free-text per the data model doc — no fake structure invented),
  reviews (empty state, since nothing can generate a real review until
  the booking + review steps exist), and an availability preview (next 4
  open dates) built on `getUpcomingAvailability`. Two edge cases handled
  distinctly: a nonexistent ID is a real 404; an existing-but-not-bookable
  profile (pending approval, or Stripe onboarding incomplete) shows a
  "not available right now" message instead, since a 404 would be
  misleading for a profile that does exist.
- **Styling** — ported the Homepage/Results/Profile sections of
  `idistinguishr-style-guide.html` / `mockups.html` into `globals.css`
  (hero, search card, teacher cards, filter sidebar, result rows, profile
  layout, mini-cal, note-rating).

**Known gap:** nothing shows up in search until a teacher is both
approved and has completed Stripe onboarding — correct per the data
model, but since neither the admin-approval UI nor Stripe Connect exist
yet, there's currently no way to get a teacher into that state except by
flipping the two DB fields manually (same manual-approval pattern noted
for `approvalStatus` in US-30). Worth a `prisma/seed.ts` at some point
(the `db:seed` script in `package.json` already expects one, but the file
doesn't exist yet) so there's always demo-able data locally — not built
now since it wasn't asked for.

**Testing performed:** seeded three teachers (one fully bookable with
weekly availability + 2 reviews via fake completed bookings, one bookable
with no availability, one pending-approval) plus two students, via a
one-off Prisma script — the teacher-facing APIs don't expose
`approvalStatus`/`stripeOnboardingComplete`/ratings by design, so seeding
those needs direct DB access, same as the real manual-approval flow will.
Verified in-browser: homepage search form and featured section render and
link correctly; results filtering by instrument, price, and
`availableThisWeek` all narrow correctly; empty state renders; profile
page renders bio/credentials/reviews/availability preview correctly with
real computed dates; the pending-approval profile shows the "not
available" message while a nonexistent ID gets a real 404. All seeded
data removed afterward.

---

## Where things stand

Done: environment, Neon + Prisma, dev server, minimal auth, teacher
profile CRUD, availability CRUD, search/results with filtering, and the
public teacher profile screen (README build order through step 3, plus
the bundled-in profile screen).

Not started: student dashboard (`/dashboard` is still a stub), the
booking flow (including the double-booking unique index noted in §4 and
proper slot-splitting in `getUpcomingAvailability`), Stripe Connect,
confirmation emails, reviews (the review *data* can already be read and
displayed — there's just no way to create one yet, since that requires a
completed booking). Next up per the build order is booking + time slot
logic.
