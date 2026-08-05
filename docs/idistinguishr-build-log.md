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

## 13. Booking + time slot logic — US-09 through US-12, US-32, US-33

The README calls this step out as the trickiest part, and it's the one
place this session spent real effort double-checking correctness rather
than just building forward.

- **`prisma/migrations/20260805103216_add_booking_no_double_book_index/`**
  — the partial unique index the schema comment had been flagging since
  the initial migration: `CREATE UNIQUE INDEX ... ON bookings
  ("teacherId", "lessonDate", "startTime") WHERE status != 'CANCELLED'`.
  Column names had to be the actual camelCase Prisma column names, not
  the snake_case the original comment assumed (there's no `@map` on those
  fields) — the first migration attempt failed shadow-DB validation over
  exactly this. This index is what makes US-32's race condition resolve
  correctly at the DB level, not just in application logic.
- **`src/lib/booking-slots.ts`** — new: `getBookableSlots(teacherId,
  durationMinutes, days)`, the precise version of the availability
  computation the profile-preview helper (`getUpcomingAvailability`)
  deliberately wasn't. Two upgrades from that simpler version: a
  `BLOCKED` exception now splits a window into up to two pieces around
  itself instead of dropping the whole window, and existing bookings
  (confirmed, completed, or still-within-hold-window pending) are
  subtracted the same way, then what's left is chunked into
  `durationMinutes`-sized slots. Also converts "now" to actual UK
  wall-clock time (`Europe/London`, via `Intl.DateTimeFormat`) to drop
  today's past slots correctly across the GMT/BST boundary, since the
  server itself doesn't necessarily run in that timezone.
- **`src/app/api/bookings/route.ts`** (`POST`) — creates the
  `PENDING_PAYMENT` hold. Requires a `STUDENT` session (401/403
  otherwise). Re-validates the requested slot against a fresh
  `getBookableSlots` call server-side rather than trusting whatever the
  client fetched earlier. The hold-expiry (US-33) and double-booking
  (US-32) logic are one transaction: first `updateMany` any
  `PENDING_PAYMENT` row at that exact teacher/date/time older than
  `HOLD_EXPIRY_MINUTES` (10) to `CANCELLED` (`cancelledBy: SYSTEM`) —
  this is the "check-on-query" release the data model doc calls for,
  since there's no background job — then `create` the new booking. If a
  genuinely active booking is already there, the `create` collides with
  the partial unique index and throws a Prisma `P2002`, caught and turned
  into a clean `409`.
- **`src/app/api/teachers/[id]/slots/route.ts`** (`GET`) — thin wrapper
  around `getBookableSlots` for the picker UI to poll when duration
  changes.
- **`src/app/book/[teacherId]/page.tsx` + `SlotPicker.tsx`** (screen 4)
  — duration (30/45/60) and format selection (hidden entirely if the
  teacher only offers one format), a date/time picker fed by the slots
  API, and a price summary. No auth required to browse/select here —
  per US-12's framing, the account only needs to exist once there's
  something to attach the hold to.
- **Auth wiring (US-12)** — `src/app/book/[teacherId]/SlotPicker.tsx`'s
  Continue button: already signed in as a student → `POST /api/bookings`
  directly, then `/checkout?bookingId=...`. Not signed in → `/auth` with
  the selection in the query string. `src/app/auth/page.tsx` reads that
  and renders a banner ("Booking Owen Blackwood — Thu 6 Aug at 15:00");
  `AuthForm.tsx` hides the role picker when a booking is in progress
  (defaults to `STUDENT`) and, right after a successful sign-up/login,
  creates the hold and redirects to checkout instead of the normal
  role-based landing page. If the slot got taken in the meantime, sends
  them back to the booking page instead of silently dropping the intent.
  Signed in as a `TEACHER` mid-booking (edge case, e.g. someone picks
  "Teacher" while a booking is pending) → normal teacher redirect, intent
  dropped — booking as a teacher isn't a real scenario.
- **Styling** — ported the mockup's Time Select section (`.flow-shell`,
  `.opt-pill`, date/time chips, `.price-summary`) plus a small
  `.booking-banner` for the auth page.

**Testing performed:** seeded teachers via script (teacher-facing APIs
intentionally don't expose booking creation as anything but the real
flow). Verified via curl: happy-path booking with correct price
calculation; booked slots correctly excluded from the next slot-list
fetch; a genuine race (two `curl` requests fired in parallel for the same
slot via bash `&`/`wait`) resolved to exactly one `201` and one `409`;
backdating a hold's `createdAt` past the 10-minute window and re-querying
confirmed it both (a) stopped blocking the slot in the listing and (b)
got auto-cancelled (`cancelledBy: SYSTEM`) the moment a new request came
in for that exact slot; format mismatch (booking `IN_PERSON` with an
online-only teacher) → `400`; a `TEACHER` session hitting the booking
endpoint → `403`; unauthenticated → `401`. Then drove the full flow in
the browser as a true anonymous visitor: picked a teacher/date/time on
`/book/[teacherId]`, hit Continue, landed on `/auth` with the correct
banner, signed up, landed on `/checkout?bookingId=...` — confirmed
directly against the DB that the resulting booking had the right
student, teacher, date/time, price, and `PENDING_PAYMENT` status. All
seeded data removed afterward.

**Known gap:** `/checkout` is still the untouched stub — it now receives
a real `bookingId` query param, but doesn't do anything with it yet.
That's intentional; actual payment is step 5 (Stripe Connect) per the
README, not this step. A `PENDING_PAYMENT` booking with no further action
will just sit there until `HOLD_EXPIRY_MINUTES` (10) passes and the next
booking attempt at that slot reclaims it — there's no active cleanup job,
by design (matches the "check-on-query" approach the data model doc
describes).

---

## 14. Stripe Connect — US-25 onboarding piece, screen 6 (Payment/Checkout)

Full "Express onboarding for teachers, checkout for students," per the
README's step 5. This turned into the most research-heavy stage so
far — the docs the project started with (`idistinguishr-stripe-connect-research.md`)
describe the classic v1 Connect Express pattern, but Stripe's current
best practice (surfaced via the `stripe-best-practices` skill, once it
became available mid-session) is the newer **Accounts v2 API**
(`/v2/core/accounts`) with a `recipient` configuration — `type: 'express'`
is explicitly a deprecated v1 pattern now. Rebuilt the onboarding piece
against v2 rather than follow the older research doc, and upgraded the
`stripe` package from `^17.5.0` to `22.4.0` to get v2 API support (the
installed 17.x had no `stripe.v2.core.accounts` at all).

- **Setup**: created a real Stripe account, enabled Connect, got test-mode
  publishable/secret keys (in `.env`). Installed the Stripe CLI via
  `winget install Stripe.StripeCli` (confirmed with user first, per the
  "explicit permission for downloads" rule) — `stripe.exe` wasn't on
  winget under the obvious ID, had to `winget search stripe` to find
  `Stripe.StripeCli`. `stripe login` is interactive (opens a browser for
  the user to authorize) — asked the user to run it themselves via `!`.
- **`src/lib/stripe.ts`** — Stripe client singleton (same pattern as
  `prisma.ts`), plus `PLATFORM_FEE_PERCENT = 10` — the platform's own cut
  via `application_fee_amount`, a business decision the research doc
  explicitly left open, not a number from Stripe's own pricing.
- **`src/app/api/stripe/connect/route.ts`** (`GET`) — creates a v2
  "recipient" configuration account (`dashboard: "express"`,
  `fees_collector`/`losses_collector: "application"` — the marketplace
  destination-charge pattern per Stripe's platform-type guidance, not the
  SaaS/direct-charge pattern) if the teacher doesn't have one yet, then
  an Account Link to Stripe's hosted onboarding, and redirects there.
  Plain GET so `<a href="/api/stripe/connect">` needs no client JS.
- **Teacher profile page** — added a "Payouts" section: not connected →
  "Connect payouts with Stripe" button; started but not finished →
  "Finish Stripe onboarding"; complete → confirmation message. Also fixed
  a latent bug this surfaced: passing the Prisma `Decimal` `avgRating`
  field straight into the client-component `TeacherProfileForm` isn't
  allowed by React Server Components ("Only plain objects can be passed
  to Client Components... Decimal objects are not supported") — was
  silently warning, not crashing, since nothing rendered that field.
- **`src/app/api/webhooks/stripe/route.ts`** — genuinely the trickiest
  part of this stage. Two real bugs found and fixed only by testing
  against actual Stripe behavior, not docs alone:
  1. Connect Accounts v2 doesn't deliver `account.updated` the classic
     way — it fires as a **thin event** (`object: "v2.core.event"`,
     e.g. type `v2.core.account[configuration.recipient].capability_status_updated`),
     a lightweight pointer rather than the full resource. Confirmed via
     Stripe's Events v2 API (`stripe.v2.core.events.list`) that these
     events genuinely fire — the classic `account.updated` case is kept
     as a defensive fallback, not the primary path.
  2. `stripe.webhooks.constructEvent` **actively rejects** thin event
     payloads — it throws "you passed an event notification... use
     stripe.parseEventNotification instead." Found only by feeding it a
     real payload and reading the error. The handler now peeks at the
     unverified `object` field only to route to the correct verifier
     (`parseEventNotification` for `v2.core.event`, `constructEvent`
     otherwise), then verifies properly either way. Whichever notification
     type fires, it re-fetches the account and checks
     `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status
     === "active"` — the documented v2 way to know a connected account can
     receive transfers (not the deprecated v1 `charges_enabled`/`payouts_enabled`).
  3. `checkout.session.completed` (classic v1, confirms the booking +
     writes the `Payment` row) is unchanged in shape from the original
     design, with fee split via `application_fee_amount` +
     `transfer_data.destination` on the Checkout Session's
     `payment_intent_data` — a destination charge.
- **`src/app/api/checkout/session/route.ts`** + **`src/app/checkout/page.tsx`**
  (screen 6) — real order summary (teacher, date/time, duration, format,
  price, 48hr cancellation policy per US-17) replacing the stub, a
  `ConfirmPayButton` client component that POSTs to create a Checkout
  Session then redirects to Stripe's hosted page. Payment failure (US-16)
  needs no special handling: an abandoned/failed Stripe checkout lands
  the student back on this same page (`cancel_url`) with the booking
  still `PENDING_PAYMENT`, and the existing hold-expiry logic from the
  booking stage reclaims it if never retried — no new code needed.
  `success_url` points at `/confirmation/[bookingId]`, matching the flow
  spec's actual sequence (Payment → Confirmation) — left as the existing
  stub, same "wire the redirect to the next step's stub, don't build
  that step" precedent as `/checkout` was left after the booking stage.

**Known gap, found and worked around, not fixed:** local Stripe CLI
webhook forwarding (`stripe listen --forward-to ...`) never reliably
delivered *any* event to localhost in this environment during testing —
not `account.updated`-family thin events (tried `--forward-thin-to`,
`--forward-thin-connect-to`, and both together) and not even the classic
`checkout.session.completed` (confirmed via Stripe's Events API that it
genuinely fired, with correct metadata, but the CLI tunnel never
delivered it). Given neither connect-flagged nor plain events came
through, this looks like a local network/firewall interaction with the
CLI's tunnel on this machine rather than an event-type routing mistake —
but that's inference, not confirmed. Worked around it for testing by
fetching the real Stripe-generated event (or, where none existed yet, a
payload matching Stripe's documented shape exactly) and POSTing it to the
endpoint with a properly HMAC-signed header via
`stripe.webhooks.generateTestHeaderString`, which exercises everything
except the CLI's delivery hop. In production this doesn't apply — Stripe
delivers directly to a real HTTPS endpoint, no local tunnel involved.

**Testing performed:** created a real Stripe test-mode teacher account,
drove the *actual* Stripe-hosted Express onboarding UI in the browser
(business type, personal details, "Use test account" bank details
shortcut) through to completion — confirmed via direct API retrieve that
`configuration.recipient.capabilities.stripe_balance.stripe_transfers.status`
genuinely became `"active"`. Delivered a signed thin-event payload to the
webhook endpoint and confirmed `stripeOnboardingComplete` flipped to
`true` in the DB, and confirmed the profile page reflected it ("Stripe is
connected"). Verified signature tampering is rejected (400) and that the
classic-event code path still works after the routing change. Then
booked a real lesson as a student, reached checkout, paid with Stripe's
`4242 4242 4242 4242` test card on the actual Stripe-hosted Checkout
page, and confirmed after webhook delivery: `Booking.status` →
`CONFIRMED`, a `Payment` row with the correct 90/10 split (£38 total,
£3.80 platform fee, £34.20 teacher payout), the real `PaymentIntent`'s
`application_fee_amount` and `transfer_data.destination` matching, and a
real `Transfer` to the connected account. Re-delivered the same webhook
event to confirm idempotency (no duplicate `Payment` row — the
`Payment.bookingId` unique constraint catch does its job). Verified the
"only students can book" guard in the actual UI (not just the API) by
attempting to book while signed in as the teacher. All seeded
data removed afterward; Stripe test-mode objects (the connected account,
events) left in place since they're free and harmless to leave.

---

## Where things stand

Done: environment, Neon + Prisma, dev server, minimal auth, teacher
profile CRUD, availability CRUD, search/results with filtering, the
public teacher profile screen, booking + time slot logic including the
double-booking/soft-hold handling, and Stripe Connect (Express
onboarding + destination-charge checkout) — README build order through
step 5.

Not started: student dashboard (`/dashboard` is still a stub — this is
also where confirmation-email sending will need to be wired in, per the
README grouping those together), confirmation page content (`/confirmation/[bookingId]`
is a stub that now correctly receives a real `bookingId` after payment,
same "wire the redirect, don't build the target yet" pattern used
throughout), reviews (the review *data* can already be read and
displayed on the public profile — there's just no way to create one yet,
since that requires `Booking.status = COMPLETED`, which nothing sets
yet — no lesson-completion mechanism exists). Next up per the build
order is dashboard + confirmation emails.
