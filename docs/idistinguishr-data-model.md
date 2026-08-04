# IDistinguishR — Data Model (MVP)

Derived from the user stories. Notation is DB-agnostic (works for Postgres/MySQL); adapt types as needed for your stack.

---

## Entity Overview

```
users ──┬── teacher_profiles ──── availability_rules
        │                    └── availability_exceptions
        │
        └── (student side has no extra profile table for MVP)

bookings ── references: student(user), teacher_profile, time slot
   │
   ├── payments (1:1 with booking)
   └── reviews (1:1 with completed booking)
```

---

## `users`

Single table for both roles — simplest for MVP since students need zero extra fields, and it makes login/auth uniform.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `role` | enum(`student`, `teacher`) | Set at signup |
| `full_name` | string | |
| `email` | string, unique | |
| `password_hash` | string, nullable | Null if OAuth-only |
| `oauth_provider` | enum(`google`,`apple`,`none`) | |
| `created_at` | timestamp | |
| `status` | enum(`active`,`suspended`) | Default `active` |

*US-12, US-13, US-14, US-25*

---

## `teacher_profiles`

One-to-one with a `users` row where `role = teacher`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → users.id | Unique |
| `bio` | text | |
| `instruments` | string[] or join table (see below) | |
| `hourly_rate` | decimal | In minor units (pence) to avoid float issues |
| `formats_offered` | enum[] (`online`,`in_person`) | |
| `location_text` | string, nullable | For in-person; null if online-only |
| `credentials` | text | Free-text for MVP; structured later if needed |
| `approval_status` | enum(`pending`,`approved`,`rejected`) | MVP manual approval — US-30 |
| `stripe_account_id` | string, nullable | Stripe Connect Express account ID, set once teacher starts onboarding |
| `stripe_onboarding_complete` | boolean, default `false` | True once Stripe verification (KYC + payout details) is complete |
| `avg_rating` | decimal, denormalized | Recalculated on new review |
| `review_count` | int, denormalized | |
| `created_at` | timestamp | |

**Bookable requires both:** a teacher only appears in search/results once `approval_status = approved` AND `stripe_onboarding_complete = true`. Either check failing keeps them hidden from students, even if the other passed.

**Note on `instruments`:** if a teacher can teach multiple instruments with different rates (e.g., piano vs. guitar priced differently), this needs to be a join table (`teacher_instruments`) instead of an array. For MVP, assume one rate across all instruments taught — simpler, revisit if needed.

*US-06, US-07, US-25*

---

## `availability_rules`

Recurring weekly availability (the pattern a teacher repeats every week).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `teacher_id` | uuid, FK → teacher_profiles.id | |
| `day_of_week` | int (0–6) | |
| `start_time` | time | UK time (`Europe/London`) — single timezone for MVP, no per-user conversion |
| `end_time` | time | |

*US-26*

## `availability_exceptions`

One-off overrides — a teacher blocking out a specific date, or opening an extra slot outside their normal pattern.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `teacher_id` | uuid, FK | |
| `date` | date | |
| `type` | enum(`blocked`,`added`) | |
| `start_time` | time, nullable | Null if entire day blocked |
| `end_time` | time, nullable | |

**Why split into two tables:** recurring rules stay small and simple to query for "what's the normal week," while exceptions handle the messy one-off cases without polluting the pattern. Actual bookable slots are computed at query time by applying exceptions on top of rules — not stored as pre-generated rows (avoids regenerating thousands of rows every time a teacher changes their schedule).

---

## `bookings`

The core transactional entity.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `student_id` | uuid, FK → users.id | |
| `teacher_id` | uuid, FK → teacher_profiles.id | |
| `lesson_date` | date | |
| `start_time` | time | |
| `duration_minutes` | int | 30 / 45 / 60 |
| `format` | enum(`online`,`in_person`) | |
| `status` | enum(`pending_payment`,`confirmed`,`completed`,`cancelled`) | See state notes below |
| `price_total` | decimal | Snapshot at time of booking — don't recalculate from teacher's current rate later |
| `created_at` | timestamp | |
| `cancelled_at` | timestamp, nullable | |
| `cancelled_by` | enum(`student`,`teacher`,`system`), nullable | |
| `cancellation_window_hours` | int, default `48` | Snapshot at booking time in case policy changes later |

**Status flow:**
```
pending_payment → confirmed → completed
       │
       └────────→ cancelled  (from pending_payment or confirmed)
```

**Concurrency / double-booking (US-32, US-33):** when a student selects a slot, create the booking row immediately as `pending_payment` with a short expiry (e.g., 10 minutes). This "soft-holds" the slot — other students querying availability should see it as unavailable while pending. A background job (or check-on-query) expires and releases stale `pending_payment` rows that never reached payment. Enforce uniqueness at the DB level with a constraint on `(teacher_id, lesson_date, start_time)` for any non-cancelled booking, so a race condition fails loudly instead of silently double-booking.

*US-09, US-31, US-32, US-33*

---

## `payments`

One-to-one with a booking.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_id` | uuid, FK → bookings.id, unique | |
| `amount` | decimal | Gross amount charged to student — matches booking.price_total |
| `currency` | string | `GBP` (UK-only for MVP) |
| `stripe_payment_intent_id` | string | |
| `stripe_transfer_id` | string, nullable | ID of the transfer to the teacher's connected account |
| `platform_fee_amount` | decimal | IDistinguishR's cut, set as the Stripe application fee at charge time |
| `stripe_processing_fee_amount` | decimal, nullable | Stripe's own cut — pulled from Stripe's balance transaction, not always known at charge time |
| `teacher_payout_amount` | decimal | Net amount transferred to teacher (amount − platform_fee_amount) |
| `status` | enum(`pending`,`succeeded`,`failed`,`refunded`) | |
| `promo_code` | string, nullable | |
| `created_at` | timestamp | |

**Why split the fee fields:** storing only the gross `amount` makes it impossible to reconcile what the platform actually earned vs. what Stripe took vs. what the teacher was paid, without re-deriving it from Stripe's dashboard every time. Splitting it out at write-time keeps payout reporting queryable directly from your own database.

*US-15, US-16, US-17*

---

## `reviews`

One-to-one with a completed booking — enforces "no review without a lesson."

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `booking_id` | uuid, FK → bookings.id, unique | Unique constraint = one review per booking |
| `student_id` | uuid, FK → users.id | Denormalized for easy querying |
| `teacher_id` | uuid, FK → teacher_profiles.id | Denormalized |
| `rating` | int (1–5) | |
| `comment` | text, nullable | |
| `created_at` | timestamp | |

**Constraint:** only allow insert if `bookings.status = completed` for the referenced booking_id — enforce in application logic and ideally a DB check/trigger too.

*US-23*

---

## Denormalization notes

- `teacher_profiles.avg_rating` and `review_count` are denormalized for fast profile/search rendering — recalculate (or increment) on every new review rather than aggregating live on every page load.
- `bookings.price_total` is a snapshot, not a live join to the teacher's current rate — protects against a teacher changing their rate after a booking is made.

## Decisions locked for MVP

1. **Timezone** — UK only, `Europe/London`. No per-user timezone conversion; store times as UK local (or UTC internally with fixed offset). Removes timezone-picker UI and DST-edge-case handling from v1 scope entirely.
2. **Multi-instrument, multi-rate teachers** — one rate per teacher, even if they teach multiple instruments. Revisit if demand shows teachers need per-instrument pricing.
3. **Refund logic** — manual for MVP. Support handles refunds via Stripe dashboard; `payments.status = refunded` gets set manually (or via a small internal admin action) until this is automated.
4. **Recurring bookings** — out of scope. Schema only supports single lessons.
5. **Cancellation window** — 48 hours, free cancellation up to 48 hrs before the lesson start time. Stored per-booking via `cancellation_window_hours` so a future policy change doesn't retroactively affect past bookings.
6. **Payments provider** — Stripe Connect, Express accounts, destination charges. Teacher payout eligibility requires both `approval_status = approved` and `stripe_onboarding_complete = true`. See the separate Stripe Connect research doc for fee structure and onboarding flow detail.
