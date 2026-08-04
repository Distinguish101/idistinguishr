# IDistinguishR

Find and book instrument teachers, online or in person. UK-only MVP.

## Stack

Next.js (React + TypeScript) · PostgreSQL · Prisma · Auth.js · Stripe Connect (Express)
See `idistinguishr-stack-decision.md` for why.

## Project docs

This repo is the build phase of a planning process — keep these in the loop as you build, not just for reference:

| Doc | Covers |
|---|---|
| `booking-flow-spec.md` | Field-by-field spec for every screen |
| `idistinguishr-user-stories.md` | Acceptance criteria per feature, US-01 to US-33 |
| `idistinguishr-data-model.md` | Full schema rationale — this is what `prisma/schema.prisma` implements |
| `idistinguishr-stripe-connect-research.md` | Payments/payout flow |
| `idistinguishr-style-guide.html` | Design tokens — copied into `globals.css`, port the rest as you build each screen |
| `mockups.html` | Clickable reference for every screen |

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database** — get a free Postgres instance ([neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) both work well with Prisma), then:
   ```bash
   cp .env.example .env
   # fill in DATABASE_URL
   npx prisma migrate dev --name init
   ```

3. **Auth** — generate a secret and add Google OAuth credentials (from [Google Cloud Console](https://console.cloud.google.com)):
   ```bash
   npx auth secret
   ```

4. **Stripe** — create a [Stripe account](https://dashboard.stripe.com/register), enable Connect, grab your test-mode keys and add them to `.env`.

5. **Run**
   ```bash
   npm run dev
   ```

## Build order

Matches the sequence in the planning docs — build in this order, not screen-by-screen top to bottom:

1. Auth (`src/lib/auth.ts` is scaffolded — wire up the `/auth` page UI)
2. Teacher profile CRUD + availability management (teachers need a way in before students can book)
3. Search/results with filtering
4. Booking + time slot logic — the soft-hold/double-booking logic in `prisma/schema.prisma` comments is the trickiest part, test this thoroughly
5. Stripe Connect (Express onboarding for teachers, checkout for students)
6. Dashboard + confirmation emails
7. Reviews

## Structure

```
src/
  app/
    page.tsx                        Screen 1 — Homepage
    results/page.tsx                Screen 2 — Results/Directory
    teachers/[id]/page.tsx          Screen 3 — Teacher Profile
    book/[teacherId]/page.tsx       Screen 4 — Select Time Slot
    auth/page.tsx                   Screen 5 — Sign Up/Login
    checkout/page.tsx               Screen 6 — Payment
    confirmation/[bookingId]/page.tsx  Screen 7 — Confirmation
    dashboard/page.tsx              Screen 8 — Dashboard
    api/auth/[...nextauth]/route.ts Auth.js handler
  lib/
    prisma.ts                       Prisma client singleton
    auth.ts                         Auth.js config (Credentials + Google)
prisma/
  schema.prisma                     Full data model — see comments for
                                     double-booking prevention, price
                                     snapshotting, and Stripe fields
```

Every page stub has TODO comments linking back to the relevant user stories and mockup screen — treat them as a checklist.
