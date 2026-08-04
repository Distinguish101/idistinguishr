# IDistinguishR — User Stories (MVP)

Organized by the approved flow. Each story follows: **As a [role], I want to [action], so that [outcome].** Acceptance criteria included where the behavior isn't obvious.

---

## Student Stories

### 1. Homepage / Search

**US-01** — As a student, I want to search by instrument and location/online, so that I only see relevant teachers.
- *AC:* Search requires at least an instrument; location/online is optional but recommended.
- *AC:* Submitting search routes to Results with query params preserved (shareable/bookmarkable URL).

**US-02** — As a student, I want to see top-rated teachers on the homepage without searching, so that I can browse casually before committing to a specific instrument.

---

### 2. Results / Directory

**US-03** — As a student, I want to filter results by price, rating, format, and availability, so that I can narrow down to teachers who actually fit my constraints.
- *AC:* Filters combine with AND logic (e.g., price AND rating AND format).
- *AC:* Filter state persists in the URL so results are shareable/bookmarkable.

**US-04** — As a student, I want to sort results (price, rating, soonest available), so that I can prioritize what matters most to me.

**US-05** — As a student, I want to see a clear empty state when no teachers match my filters, so that I know to adjust rather than assume the site is broken.

---

### 3. Teacher Profile

**US-06** — As a student, I want to view a teacher's bio, credentials, and rate before booking, so that I can decide if they're a good fit.

**US-07** — As a student, I want to read reviews from other students, so that I can trust the teacher's quality before spending money.

**US-08** — As a student, I want to see the teacher's live availability preview on their profile, so that I don't click into a teacher who has nothing open soon.

---

### 4. Time Selection

**US-09** — As a student, I want to pick a specific date and time from the teacher's real availability, so that I don't book a slot that isn't actually free.
- *AC:* Slots already booked by another student are not selectable.
- *AC:* Times display in the student's local timezone.

**US-10** — As a student, I want to choose lesson length and format (online/in-person) if the teacher offers options, so that the booking matches what I actually want.

**US-11** — As a student, I want to see the total price before continuing, so that there are no surprises at checkout.

---

### 5. Sign Up / Login

**US-12** — As a student, I want to create an account only after I've picked a time, so that I'm not forced to sign up before I know if there's even a slot that works for me.
- *AC:* Selected teacher/time/format persists through signup and into payment (not lost on redirect).

**US-13** — As a returning student, I want to log in instead of creating a new account, so that I can rebook quickly with saved details.

**US-14** — As a student, I want the option to sign up with Google/Apple, so that I don't have to create and remember a new password.

---

### 6. Payment

**US-15** — As a student, I want to review my full order summary (teacher, date, time, price) before paying, so that I can catch mistakes before money changes hands.

**US-16** — As a student, I want to enter payment details securely and get clear feedback if payment fails, so that I know whether my booking went through.
- *AC:* Failed payment does NOT create a confirmed booking; slot is released back to availability.

**US-17** — As a student, I want to see the cancellation policy before I pay, so that I know my options if my plans change.

---

### 7. Confirmation

**US-18** — As a student, I want immediate confirmation that my booking succeeded, so that I'm not left wondering if it worked.

**US-19** — As a student, I want to add the lesson to my calendar in one click, so that I don't forget it or double-book myself.

**US-20** — As a student, I want an email confirmation with the same details, so that I have a record outside the app.

---

### 8. Dashboard

**US-21** — As a student, I want to see my upcoming lessons in one place, so that I know what's coming without digging through emails.

**US-22** — As a student, I want to reschedule or cancel a lesson from my dashboard, so that I don't have to email support for routine changes.
- *AC:* Cancellation respects the policy shown at checkout (e.g., free up to 24 hrs before).

**US-23** — As a student, I want to leave a review after a completed lesson, so that I can help other students and give feedback to my teacher.
- *AC:* Review prompt only appears for lessons marked completed, and only once per booking.

**US-24** — As a student, I want to see an inviting empty state when I have no lessons yet, so that I'm nudged to book rather than seeing a blank/broken-looking page.

---

## Teacher Stories

*(Not in the primary student flow, but required for the marketplace to function — teachers need a way in.)*

**US-25** — As a teacher, I want to create a profile with my bio, instruments, rate, and credentials, so that students can find and evaluate me.

**US-26** — As a teacher, I want to set my recurring weekly availability, so that students can only book times I'm actually free.

**US-27** — As a teacher, I want to see my upcoming and past lessons in a dashboard, so that I can prepare and track my schedule.

**US-28** — As a teacher, I want to see my earnings and payout status, so that I know what I've made and when I'll be paid.

**US-29** — As a teacher, I want to receive a notification when a student books a lesson, so that I don't miss it.

**US-30** — As a teacher (MVP only), I want my profile reviewed/approved before going live, so that the platform can maintain quality and trust early on.
- *Note: manual approval is a deliberate MVP shortcut — see scope-cutting notes from earlier. Self-serve onboarding can come later.*

---

## Cross-Cutting / System Stories

**US-31** — As a student or teacher, I want booking status changes (confirmed, cancelled, rescheduled) reflected in real time on both sides, so that neither party is working off stale information.

**US-32** — As the platform, I want to prevent double-booking of the same slot, so that two students can never book the same teacher at the same time.
- *AC:* This needs to be enforced at the database/booking-logic level, not just the UI — a race condition (two students booking simultaneously) must resolve to one success and one clear failure.

**US-33** — As the platform, I want failed or abandoned bookings (e.g., user drops off at payment) to automatically release the held time slot after a timeout, so that slots don't get stuck as unavailable.

---

## Explicitly Out of Scope for MVP

- In-app messaging (deferred — use email for now)
- Self-serve teacher onboarding (manual approval instead)
- Group lessons / multi-student bookings
- Package deals or subscriptions (single lesson bookings only)
- Refunds beyond the stated cancellation policy (handled manually via support)
