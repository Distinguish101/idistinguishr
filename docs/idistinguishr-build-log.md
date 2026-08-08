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

## 15. Dashboard + confirmation emails — screens 7 & 8, US-18 through US-24

README step 6. Also finished screen 7 (Booking Confirmation) for real,
since it's the direct landing target of the checkout success redirect
from the previous stage and had been left as a stub on purpose until now.

- **`src/lib/ics.ts`** + **`src/app/api/bookings/[id]/ics/route.ts`**
  (US-19) — a plain `.ics` calendar file, generated on request (no
  library — the format is simple enough not to need one) and served with
  `Content-Disposition: attachment` behind an ownership check. Emits
  floating local time (no `Z` suffix, no `VTIMEZONE` block) rather than a
  timezone-correct UK time — consistent with the rest of the app, which
  already treats stored times as literal wall-clock values everywhere
  else per the data model doc's "no per-user timezone conversion"
  decision, not a new inconsistency introduced here.
- **`src/app/confirmation/[bookingId]/page.tsx`** (screen 7, US-18) —
  real summary replacing the stub: success state, booking details,
  Add-to-Calendar link, Go to Dashboard CTA. Three non-success states
  handled distinctly: not found/not yours (ownership check, same pattern
  as checkout), still `PENDING_PAYMENT` (webhook hasn't landed yet —
  polite "finalizing" message rather than an error), and `CANCELLED`.
  Still no side effects on load, per the original TODO comment — the
  email send lives in the webhook, not here.
- **`src/lib/complete-past-bookings.ts`** — a real gap worth flagging:
  nothing in this codebase ever moves a booking from `CONFIRMED` to
  `COMPLETED` — there's no lesson-attendance-confirmation step anywhere
  in the user stories or data model. Since `COMPLETED` is a real enum
  value the state-flow diagram in the data model doc expects, and US-23
  (leave a review) explicitly requires it, this treats "the lesson's
  calendar date has fully passed" as "the lesson happened" and flips
  status accordingly — called at the top of the Dashboard page load, same
  check-on-query philosophy as the booking-hold expiry rather than a cron
  job.
- **`src/app/api/bookings/[id]/cancel/route.ts`** (US-22) — enforces the
  `cancellationWindowHours` cutoff server-side (the snapshotted
  per-booking value, not a live policy lookup). The cutoff math treats
  the stored lesson date/time as UTC directly rather than resolving the
  actual Europe/London offset for that date, which can be off by up to an
  hour during BST — flagged in a code comment as the same explicit
  "no DST-edge-case handling in v1" tradeoff the data model doc already
  makes for the whole app, not a new shortcut.
- **`src/app/api/reviews/route.ts`** (US-23) — creates a `Review`, gated
  on `Booking.status === COMPLETED` and one-per-booking (the `Review.bookingId`
  unique constraint backs this up at the DB level too, not just the
  pre-check). Recalculates `TeacherProfile.avgRating`/`reviewCount` from
  a fresh aggregate on every new review, per the data model doc — cheap
  at MVP review volumes, no need for an incremental running-average.
  Whether to build review *creation* now versus treating it as step 7's
  job was a real judgment call — the Dashboard stub's own TODO comments
  explicitly call for the "Leave a Review" prompt as in-scope here, and a
  dead-end button would've been worse than just building the small form,
  so it's done now; step 7 is presumably about more than this (review
  moderation, breakdowns, etc. — nothing concrete specified yet).
- **`src/app/dashboard/page.tsx`** (screen 8, US-21/22/23/24) — replaces
  the stub: Upcoming/Past tabs via a plain `?tab=` query param (no client
  state), Upcoming shows `CONFIRMED` bookings with a two-step inline
  Cancel (deliberately not a native `confirm()` dialog — those block
  automated browser testing and don't match the site's styling), Past
  shows `COMPLETED` (with the review prompt or a "Reviewed" badge) and
  `CANCELLED` (with a badge, no actions) bookings. Empty state (US-24)
  only shows when the student has zero bookings at all, not just an empty
  tab — a per-tab "Nothing here yet" otherwise, to avoid over-showing the
  big "find a teacher" CTA to someone who clearly already has.
  "Reschedule" (mentioned in the mockup/spec) isn't built — there's no
  modeled operation for it anywhere in the schema, and cancel-then-rebook
  achieves the same result without inventing new scope.
- **`src/lib/email.ts`** (US-20) — set up a real Resend account this
  session (API key in `.env`). Sends from `onboarding@resend.dev` (no
  domain verification done), which Resend restricts in two ways worth
  knowing: it rejects sending to made-up domains like `@example.com`
  outright (422 `validation_error`) and otherwise can only actually
  deliver to the Resend account's own registered email — `delivered@resend.dev`
  is Resend's documented always-succeeds test address, used here to prove
  delivery genuinely works rather than just that the API call doesn't
  error. Wired into the `checkout.session.completed` webhook case, after
  the DB transaction commits — a failed send is caught and logged, not
  thrown, since the payment already succeeded by that point and re-taking
  money isn't on the table; Stripe's retry would just hit the same
  idempotency short-circuit anyway.

**Testing performed:** seeded a teacher (reusing the real Stripe-onboarded
test account from the previous stage) and one student with six bookings
spanning every state this stage touches — upcoming well outside the 48hr
window, upcoming just inside it, past+completed+unreviewed,
past+completed+already-reviewed, past+cancelled, and a `CONFIRMED`
booking dated yesterday specifically to test the auto-complete transition.
Confirmed in the browser: the yesterday-dated booking correctly flipped
to `COMPLETED` and moved to the Past tab on the first Dashboard load;
cancelling the in-window booking was correctly rejected with the exact
policy message, cancelling the outside-window one succeeded and moved it
to Past with a `CANCELLED` badge; submitting a review updated
`avgRating`/`reviewCount` correctly (verified in the DB: two 5-star
reviews → `avgRating: 5`, `reviewCount: 2`). Verified via curl with a
second student account that viewing/cancelling/downloading the `.ics` for
someone else's booking all correctly 404. Verified the review endpoint
rejects a second review on the same booking (409) and reviewing a
cancelled or still-upcoming booking (400, not `COMPLETED`). For email:
proved the Resend integration itself works (real message ID back from
the API), then delivered a real signed `checkout.session.completed`
event at a booking whose student email was Resend's guaranteed-delivery
test address, and confirmed no error was logged — the full
webhook → confirm booking → create Payment → send email pipeline works
end to end, not just each piece in isolation. All seeded data removed
afterward.

---

## 16. Teacher dashboard — US-27 (upcoming/past lessons), US-28 (earnings/payouts)

Not one of the README's numbered screens (same situation as the teacher
profile/availability pages), but a clear functional gap: teachers had no
way to see their own booked lessons or what they'd earned. Built as a
mirror of the student dashboard (`src/app/dashboard/page.tsx`) rather
than a new pattern:

- **`src/app/teacher/dashboard/page.tsx`** — gated to `TEACHER` role
  with an existing `TeacherProfile` (redirects otherwise). Same
  Upcoming/Past tabs via `?tab=` query param as the student dashboard,
  same `lesson-row` rendering, but scoped to `teacherId` instead of
  `studentId`, showing the student's name instead of the teacher's, and
  deliberately read-only — no cancel or review actions, since neither
  user story asks for one on this side. Each row also shows the price,
  which the student dashboard doesn't need since the student already
  knows what they paid.
- **Earnings card (US-28)** — "when will I be paid" doesn't need a
  rebuilt payout UI; Stripe's Express Dashboard already has one. Built
  as two pieces instead: (a) an in-app total, summed via
  `prisma.payment.aggregate` on `teacherPayoutMinorUnits` for
  `SUCCEEDED` payments joined through the teacher's bookings (`Payment`
  has no direct `teacherId`, only `bookingId`), and (b) a "View payouts
  in Stripe" link to a new route that generates a real Express Dashboard
  login link, gated behind `stripeOnboardingComplete` — before that's
  true the card shows a prompt back to the profile page instead of a
  broken link.
- **`src/app/api/stripe/dashboard-link/route.ts`** — new GET route:
  auth + role check, confirms `stripeOnboardingComplete`, then calls
  `stripe.accounts.createLoginLink(id)` and redirects there.
  `createLoginLink` is still the classic v1-surface method — Express
  dashboard access wasn't moved under `stripe.v2.core` the way account
  creation was, and it works for v2-created accounts since it's keyed
  by account ID rather than by which API created the account.
- **`src/lib/complete-past-bookings.ts`** — this already existed for the
  student dashboard, but was scoped to a single `studentId`. That meant
  a teacher loading their dashboard before any student had loaded theirs
  would see stale `CONFIRMED` status on lessons whose date had already
  passed. Removed the scope entirely (now an unscoped table-wide
  `updateMany` on `status: CONFIRMED, lessonDate: < today`) — both
  dashboards call it now, whichever loads first fixes up the table for
  both. Cheap at MVP data volumes; not worth tracking which side already
  ran it.
- **`src/components/NavBar.tsx`** — added a third teacher nav link
  ("Dashboard") alongside the existing Profile/Availability links.

**Testing performed:** seeded a throwaway teacher (`@example.com` email,
cleaned up afterward) with five bookings covering every state this page
touches — an upcoming `CONFIRMED` lesson, two past `COMPLETED` lessons
each with a `SUCCEEDED` `Payment`, a past `CANCELLED` lesson, and a
`CONFIRMED` lesson dated yesterday specifically to prove the now-unscoped
`completePastBookings()` still catches it. Verified in the browser:
logging in as the teacher and loading the dashboard correctly flipped
the yesterday-dated booking to `COMPLETED` and moved it to the Past tab
on first load; the Upcoming tab showed only the genuinely future lesson;
the Past tab showed all four past bookings in descending date order with
the cancelled one badged; the earnings total matched the sum of the two
payouts exactly (£17.00 + £34.00 = £51.00) with the correct "from 2 paid
lessons" count. Verified both earnings-card states: with
`stripeOnboardingComplete: false` it showed the "connect Stripe from
your profile" prompt with no button; flipping the field to `true` (with
a fake `stripeAccountId`, so the actual redirect wasn't followed —
`createLoginLink`'s correctness was already confirmed by inspecting the
Stripe SDK's type definitions rather than by hitting the live API with a
bogus account) made the "View payouts in Stripe" button appear as
expected. `npx tsc --noEmit` clean. All seeded data removed afterward.

**Known gaps:** none specific to this stage — it's a straightforward
read-only view. General gaps are unchanged from earlier sections (see
below).

---

## 17. Admin teacher approval (US-30) + local Stripe webhook forwarding

Prompted by walking through "sign up a real teacher and student, would it
all work" — two gaps surfaced: nothing but a direct DB edit could ever
move a teacher out of `PENDING`, and `stripeOnboardingComplete` /
booking confirmation only ever flip via a Stripe webhook that had never
actually been proven to reach localhost (every prior test used a
manually-signed synthetic payload as a workaround, per earlier sections
of this log — no Stripe CLI was even installed).

**Admin approval:**
- **`src/lib/admin.ts`** — `isAdminEmail()`, checking `session.user.email`
  against a comma-separated `ADMIN_EMAILS` env var. Deliberately not a
  `Role` enum value: the schema only has `STUDENT`/`TEACHER`, and half
  the app's redirects assume "not TEACHER" means "STUDENT"
  (`src/app/dashboard/page.tsx`, `src/app/post-auth/page.tsx`, etc.) —
  adding `ADMIN` there would mean auditing and fixing every one of those.
  An email allowlist sidesteps that entirely: any existing account (any
  role) becomes admin just by its email being listed, no new signup
  flow, no schema migration.
- **`src/app/admin/page.tsx`** — gated the same way every other
  role-gated page in this app is (redirect if not signed in or not
  admin), Pending/Approved/Rejected tabs via `?status=`, one card per
  teacher showing bio/instruments/rate/credentials plus whether Stripe
  is connected — that last bit matters because an admin approving
  someone who hasn't connected Stripe yet is still leaving them
  unbookable, worth knowing at a glance.
- **`src/app/api/admin/teachers/[id]/route.ts`** — single `PATCH`
  accepting `{ approvalStatus: "APPROVED" | "REJECTED" }`, admin-gated
  the same way. One route for both directions since it's one field
  transition, not two separate operations.
- **`src/components/NavBar.tsx`** — shows an "Admin" link for allowlisted
  emails, independent of the Dashboard/Profile/Availability links that
  are gated on role.

**Stripe webhook forwarding:** the Stripe CLI wasn't installed at all —
confirmed with `which stripe` before assuming anything about why
forwarding hadn't worked. Installed via `npm i -g @stripe/cli`
(`--allow-scripts` needed once, for the postinstall step that pulls the
platform binary). `stripe listen` supports both the classic event stream
(`--events` / `--forward-to`) and v2 thin events (`--thin-events` /
`--forward-thin-to`) as separate flag pairs, both pointed at the same
`/api/webhooks/stripe` route since that route already branches on
payload shape. Authenticated non-interactively via `--api-key`, reading
`STRIPE_SECRET_KEY` straight out of `.env` — no `stripe login` browser
flow, no dependency on an interactive session. Confirmed the signing
secret (`--print-secret`) is stable across separate `stripe listen`
invocations for the same API key, not regenerated per run, so
`STRIPE_WEBHOOK_SECRET` in `.env` only needed setting once. Packaged the
exact command as **`scripts/stripe-listen.mjs`** (`npm run
stripe:listen`) so this doesn't need re-deriving next time — it reads
`.env` itself rather than requiring the key to be passed in some
shell-specific way, which matters cross-platform (this project's dev
environment mixes Git Bash and PowerShell).

**Testing performed:** created a throwaway admin account (`@example.com`,
added temporarily to `ADMIN_EMAILS`, removed after) and a throwaway
teacher, both signed up through the real `/auth` flow. Confirmed the
pending teacher appeared on `/admin` with correct profile details, that
Approve moved it to the Approved tab and REJECTED teachers would move to
Rejected, and that a non-admin session gets redirected away from `/admin`
entirely. Then — the actual point of this stage — logged in as the
teacher and ran the **real** hosted Stripe onboarding flow (Stripe's
test-mode "use test phone number" / "use test account" shortcuts, no
synthetic payloads), and watched `stripe listen`'s own log: both
`v2.core.account[configuration.recipient].capability_status_updated`
thin events and classic `account.updated` events arrived and were
forwarded, each answered `200` by `/api/webhooks/stripe`. Confirmed in
the DB that `stripeOnboardingComplete` flipped to `true` from that real
webhook traffic — not a manually-signed one — and confirmed in the
browser that the teacher's profile page updated to "Stripe is connected"
and that the now-fully-bookable teacher's instrument ("Violin") appeared
in the homepage search dropdown, which had been empty (correctly —
`getInstrumentOptions()` only lists bookable teachers) before any teacher
existed. `npx tsc --noEmit` clean. All test accounts, the temporary
`ADMIN_EMAILS` addition, and scratch scripts removed afterward.

**Known gaps:** `stripe listen` needs to be running
(`npm run stripe:listen`) for Connect status updates or booking
confirmations to land locally at all — it's a manual step, not something
the dev server starts on its own. No auth for the admin API route beyond
the email check (fine at this scale; would want session/CSRF hardening
before this pattern went anywhere near production). No audit trail of
who approved/rejected what or when.

---

## 18. Homepage hero image

Pure polish, prompted by the hero section being a flat wood-colored
square with a lone music-note glyph — the only spot on the marketing
page with no real visual interest.

- **`next.config.js`** — added `images.remotePatterns` for
  `images.unsplash.com`. Required: Next's `<Image>` refuses to optimize
  from a host it doesn't know about, and this project has no image
  storage of its own yet (no `photoUrl` anywhere in the schema), so an
  external host is the only option without adding upload/storage
  infrastructure for one hero photo.
- **`src/app/page.tsx`** — swapped the placeholder `<div className="hero-art">♪</div>`
  for a real photo (a guitar lesson, sourced from Unsplash, verified by
  fetching the actual photo page rather than guessing a CDN URL), with
  the brass note glyph kept as a small circular badge overlaid in the
  corner rather than dropped entirely — keeps a bit of the original
  mark/brand continuity instead of just replacing one thing with
  another.
- **`src/app/globals.css`** — `.hero-art` now clips/covers an `<img>`
  (`object-fit: cover`, `overflow: hidden`) instead of centering a glyph;
  added the `.badge` styles for the overlaid note.

Scoped to the homepage hero only, not teacher cards — the "Top-rated
this month" cards on this page and the results/profile pages pull from
real teacher data with no `photoUrl` field, so giving them a stock photo
would misrepresent an actual teacher's listing as having a real photo.
That's a separate, bigger decision (schema migration + upload or URL
field + updating every card that renders a teacher) that wasn't asked
for here.

**Testing performed:** loaded the homepage in the browser after a dev
server restart (required — `next.config.js` changes aren't picked up by
the same live env-reload that `.env` edits get). Confirmed the image
renders, is sized correctly at the hero's `1/1` aspect ratio, and that
the section below (the wood-toned "staff" divider and "How it works"
steps) still lays out correctly with no overlap. `npx tsc --noEmit`
clean.

**Also in this pass — real logo.** The navbar's "♪ IDistinguishR" was
plain text with a glyph standing in for a mark; swapped it for a
provided `public/logo.png` (a brass circular note+crown icon with an
"IDISTINGUISHR" wordmark, transparent background, 1280×371) via
`next/image` in `src/components/NavBar.tsx`, sized to 110×32 to fit the
navbar. No `next.config.js` change needed this time — local files under
`public/` don't go through the remote-pattern allowlist that external
hosts like the hero photo's Unsplash URL do. Cleaned up `.logo`'s
now-dead text-styling CSS (font-family/size/weight/color, the
`.logo .mark` color rule) since there's no text node to style anymore.

---

## 19. Seeded demo teachers, for a shareable link people can actually test

Prompted by wanting a URL to send to people to test as students — which
needed real, bookable teachers to search and book, not an empty
homepage. `package.json` already referenced `npm run db:seed` →
`tsx prisma/seed.ts`, but that file never existed.

- **Five real teacher accounts**, signed up through the actual `/auth`
  flow (not fabricated DB rows): Maya Okonkwo (Piano, £35/hr, Online +
  In-person London), Tomasz Nowak (Guitar, £30/hr, Online only), Priya
  Shah (Violin, £45/hr, In-person only, Manchester), Ben Whitfield
  (Voice, £40/hr, Online + In-person Bristol), Kofi Mensah (Drums,
  £28/hr, Online + In-person Birmingham) — each with a real bio,
  credentials, and weekly availability.
- **Admin approval and Stripe onboarding done for real**, not scripted.
  Checked first whether the v2 Accounts API supports the same
  test-data-shortcut identity fields the classic v1 API documents
  (`docs.stripe.com/connect/testing`) to skip the hosted UI entirely —
  the fetched v2 create-account reference didn't show an equivalent for
  `identity.individual` test verification, and confirming one would've
  meant open-ended trial-and-error against the live API, so onboarding
  was done through the same hosted flow as every earlier Stripe test in
  this log ("Use test phone number" → "Use test account" → Agree and
  submit).
- **Both the dev server and the browser automation got unreliable partway
  through.** The Next.js dev server intermittently wedged into a
  `Jest worker encountered N child process exceptions` state (auth
  routes 500ing, nothing else affected) — worked around each time by
  killing the process tree, clearing `.next`, and restarting; root cause
  not identified, no fix beyond "restart it" exists yet. Separately, and
  apparently unrelated, the browser automation's tab itself started
  repeatedly dropping mid-flow. Rather than keep retrying blind, handed
  both the admin approvals and the 5 rounds of Stripe onboarding to the
  user directly — a plain login + a few clicks each, no special access
  needed beyond what any teacher account already has.
- **`prisma/seed.ts`** — written after the real accounts existed, not
  before. Captures the same profile/availability data plus each
  teacher's real (now-onboarded) `stripeAccountId`, so re-running the
  seed after a DB wipe restores working, bookable teachers without
  repeating the Stripe onboarding step — that part can't be scripted,
  but only needs doing once. Also seeds 3 throwaway students and 5 past
  `COMPLETED` bookings with `SUCCEEDED` payments and reviews, so ratings
  aren't all "0.0 (0)" — one teacher (Kofi) was deliberately left with
  no reviews for variety. Idempotent: users upsert by email, profiles
  upsert by `userId`, availability/bookings/reviews are cleared and
  rebuilt each run.
- **`package.json`** — added the `"prisma": { "seed": "tsx prisma/seed.ts" }`
  block Prisma's CLI convention expects, so `npx prisma db seed` (and
  `prisma migrate reset`'s auto-seed) work too, not just the existing
  `npm run db:seed` alias.

**Testing performed:** loaded the homepage, `/results`, and a full
teacher profile page in the browser after seeding — confirmed the
"no teachers live yet" homepage message is gone, the instrument dropdown
lists all 5 instruments, "Top-rated this month" shows the 3 highest-rated
teachers in the right order, `/results` shows all 5 with correct
ratings/review counts/formats/prices, and a teacher profile page renders
the real review text and availability slots matching what was configured.
`npx tsc --noEmit` clean.

**Known gaps:** the 5 Stripe test accounts and their onboarding can't be
recreated by the seed script itself — if these specific test-mode
accounts ever get revoked or the Stripe test environment resets, new
ones need onboarding through the hosted flow again (same one-time cost
as this round). No cleanup story yet for bookings/reviews real testers
create against these teachers — left as-is for now per user's call.

---

## 20. Teacher photos, homepage carousel, footer/legal pages, mobile pass

Four smaller pieces done together as one frontend-polish stage.

**Teacher photos.** Added `TeacherProfile.photoUrl` (plain optional URL
field, migration `20260808144151_add_teacher_photo_url`) rather than a
file-upload pipeline — same reasoning as every other "just a URL field"
decision in this log. Wired into every place a teacher photo renders
(results cards, the public profile hero, the new carousel) and added a
"Photo URL" input to the teacher profile form + `/api/teacher/profile`.
One thing worth flagging: this field accepts *any* URL a teacher enters,
not just Unsplash, so teacher photos render via a plain `<img>` tag
rather than `next/image` — Next's image optimizer requires every host to
be allow-listed up front in `next.config.js`, which doesn't work for
"whatever URL a real teacher pastes in." The curated, fixed-URL images
this app controls itself (the hero photo, the logo) still use
`next/image` for the optimization benefit; only user-submitted photos
skip it. Sourced real portrait photos (Unsplash) for the 5 seeded
teachers as a result.

**Homepage carousel.** Replaced the static 3-card "Top-rated this month"
grid with `src/components/TeacherCarousel.tsx` — a plain flex row with
CSS scroll-snap, not a JS library. Auto-advances every 4.5s, pauses on
hover/touch, arrow buttons call the same `scrollBy` the auto-advance
timer uses. Widened `getFeaturedTeachers()`'s default call from 3 to 8
so there's actually something to scroll through.

**Footer + legal pages.** Added `src/components/Footer.tsx` (Terms /
Privacy / Contact links) wired into `layout.tsx` via a flex `.page-shell`
so it sticks to the bottom on short pages instead of floating mid-page.
`/terms` and `/privacy` are draft boilerplate — grounded in what the app
actually does (48hr cancellation window, 10% platform fee, Stripe holds
card data not us) rather than generic filler, but not lawyer-reviewed
and using a placeholder `.example` contact address. Needs real business
details (registered entity, jurisdiction, actual contact) before this
is production-ready — flagged here so it doesn't quietly get treated as
final.

**Mobile pass.** Before this, zero `@media` queries existed anywhere in
`globals.css` — nothing had been checked below desktop width all build.
Confirmed broken on a real narrow viewport (see testing note below): the
hero photo pushed fully off-screen by an unstacked 2-column grid, the
homepage search card crushed to ~60px-wide fields, several 3-column
grids cramming text. Added one `@media (max-width: 680px)` block at the
end of `globals.css` — not a mobile-first rebuild, targeted fixes for
the fixed-column grids that don't degrade on their own (hero, search
card, "how it works" steps, results filters+list, teacher profile
sidebar, lesson rows, the new carousel). Flex-based layouts with
`flex-wrap` already in place (the booking flow's date/time pills, the
auth card) needed no changes — confirmed fine as-is.

**Testing performed:** `resize_window` doesn't actually change the
rendered viewport in this environment (confirmed via
`window.innerWidth` staying at desktop width after resizing) — worked
around it by injecting a same-origin `<iframe>` at 390×844 into a blank
tab, which gets a genuine independent viewport for media-query purposes.
Walked the homepage, results, a teacher profile, the booking flow, and
the auth page through that iframe both before and after the CSS
changes — confirmed each specific breakage found before the fix, and
confirmed it resolved after. Teacher photos verified in the browser
across results/profile/carousel. `npx tsc --noEmit` clean throughout.

**Known gaps:** the dashboards (student, teacher, admin) got the same
defensive `@media` treatment as everything else but weren't individually
walked through the iframe the way the public-facing pages were — lower
priority since they're behind auth, not what a shared public link
exposes first. `next.config.js`'s `plus.unsplash.com`/`images.unsplash.com`
allow-listing is now only exercised by the fixed hero-photo URL, not by
teacher photos (those moved to plain `<img>`, see above) — harmless to
leave, but worth knowing it's not load-bearing for teacher photos
specifically.

---

## Where things stand

Done: environment, Neon + Prisma, dev server, minimal auth, teacher
profile CRUD, availability CRUD, search/results with filtering, the
public teacher profile screen, booking + time slot logic, Stripe Connect,
the dashboard/confirmation/reviews/email stage, the teacher dashboard,
admin teacher approval, working local Stripe webhook forwarding, a
homepage hero image, seeded demo teachers, and a frontend-polish pass
(teacher photos, homepage carousel, footer/legal pages, mobile layout
fixes) — README build order through step 6, plus the review-creation
piece of step 7 done early (see §15 for why), plus five things the
README doesn't number at all: the teacher-side dashboard (§16, closing a
gap step 6 left on the student side only), admin approval + webhook
forwarding (§17, closing gaps found by actually trying the
signup-to-bookable path end to end), the hero image (§18, pure visual
polish), seeded demo teachers (§19, so there's something to actually see
and book on a shared link), and the photos/carousel/footer/mobile pass
(§20, closing gaps found by checking the site actually looks right —
including on a phone, which nothing had ever confirmed until now).

Not started: any further review-related work step 7 might still cover
(nothing concrete specified beyond creation, which is done). That's
everything in the README's build order — every stage through step 7 has
at least a working vertical slice. Known rough edges are flagged
throughout this log rather than repeated here: the double-booking index
migration's raw SQL, `getUpcomingAvailability`'s coarser-than-booking
interval math, Google OAuth's missing adapter schema, the BST-offset
tradeoff in cancellation-window math, `stripeProcessingFeeMinorUnits`
never being populated (Stripe reports the actual processing fee
asynchronously via a balance transaction, not on the checkout session
itself, and nothing yet listens for that event), `stripe listen` needing
to be manually running for any local Stripe webhook to land (§17), and
this dev environment's occasional dev-server/browser instability under
sustained automated use (§19) — no root cause found yet, only
"restart it" as a working mitigation.
