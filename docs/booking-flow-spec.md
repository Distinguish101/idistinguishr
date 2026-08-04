# Instrument Teacher Marketplace — Flow Spec

**Flow:** Homepage → Results/Directory → Teacher Profile → Select Time Slot → Sign Up/Login → Payment/Checkout → Booking Confirmation → Dashboard

---

## 1. Homepage

**Purpose:** Entry point, capture search intent immediately.

**Components:**
- Nav bar (logo, About, FAQ, Login link)
- Hero with search bar: instrument dropdown/autocomplete + location input (or "Online" toggle)
- Secondary filters visible or one click away: price range, availability (this week/weekend), lesson format (online/in-person)
- Featured/top-rated teachers carousel (optional, builds trust)
- "How it works" 3-step visual (Search → Book → Learn)
- Footer (Terms, Privacy, Contact)

**Fields/Data:**
- `instrument` (required to proceed)
- `location` or `format` (online/in-person)

**States:**
- Empty (default)
- Search submitted → routes to Results

---

## 2. Results / Directory

**Purpose:** Let user compare and narrow down teachers.

**Components:**
- Search bar (persisted from homepage, editable)
- Filter sidebar: instrument, price range, rating, availability, format, experience level, language
- Sort dropdown (relevance, price low-high, rating, soonest available)
- Teacher cards (grid or list): photo, name, instrument(s), rate, rating + review count, short bio snippet, "View Profile" CTA
- Pagination or infinite scroll
- Empty state: "No teachers match — adjust filters"

**Fields/Data:**
- Filter state (instrument, price, rating, format, availability)
- Sort state

**States:**
- Loading (skeleton cards)
- Populated results
- Empty results
- Error (search failed)

---

## 3. Teacher Profile

**Purpose:** Build trust, provide enough info to commit to booking.

**Components:**
- Header: photo, name, instruments, rate/hour, rating summary
- Bio / teaching philosophy
- Credentials/experience (years teaching, education, certifications)
- Availability calendar preview
- Reviews section (rating breakdown + individual reviews, paginated)
- Lesson format badges (online/in-person, group/1-on-1)
- Sticky CTA: "Select a Time" button
- Optional: intro video, sample lesson clip

**Fields/Data:**
- `teacher_id`
- Reviews (rating, comment, student name, date)

**States:**
- Loading
- Fully loaded
- Teacher unavailable/inactive (edge case — show message + suggest similar teachers)

---

## 4. Select Time Slot

**Purpose:** Convert browsing into a committed action before asking for account.

**Components:**
- Calendar/week view showing teacher's available slots
- Timezone indicator/selector
- Lesson length selector (30/45/60 min, if teacher offers multiple)
- Format confirmation (online/in-person — with address if in-person)
- Price summary (rate × duration)
- "Continue" CTA (leads to Sign Up/Login)

**Fields/Data:**
- `selected_date`
- `selected_time`
- `duration`
- `format`

**States:**
- No slots available (edge case — prompt to message teacher or pick another)
- Slot selected → enabled Continue button

---

## 5. Sign Up / Login

**Purpose:** Authenticate only once intent is confirmed, minimizing drop-off.

**Components:**
- Toggle between Sign Up / Login
- Sign Up fields: name, email, password (or OAuth: Google/Apple)
- Login fields: email, password (or OAuth)
- "Forgot password" link
- Persisted context banner: "Booking [Teacher Name] — [Date/Time]" so user doesn't lose place
- Terms of Service checkbox (sign up only)

**Fields/Data:**
- `name`, `email`, `password`
- Session token on success

**States:**
- Default (empty form)
- Validation errors (invalid email, weak password, email taken)
- OAuth in progress
- Success → routes to Payment

---

## 6. Payment / Checkout

**Purpose:** Complete the transaction.

**Components:**
- Order summary: teacher, date/time, duration, format, price
- Payment method input (card fields, or saved card if returning user)
- Promo code field (optional)
- Cancellation policy summary
- "Confirm & Pay" CTA

**Fields/Data:**
- `payment_method`
- `total_amount`
- `promo_code` (optional)

**States:**
- Default
- Processing (spinner/disabled button)
- Payment failed (error message, retry)
- Success → routes to Confirmation

---

## 7. Booking Confirmation

**Purpose:** Reassure the user the booking is locked in; reduce post-purchase anxiety.

**Components:**
- Success message/checkmark
- Booking summary (teacher, date/time, format, location/link)
- "Add to Calendar" button (Google/Apple/Outlook)
- Next steps note (e.g., "Teacher will confirm within 24 hrs" or "Join link sent to your email")
- CTA: "Go to Dashboard"

**Fields/Data:**
- `booking_id`
- Confirmation timestamp

**States:**
- Success (default — payment already validated in prior step)
- Edge case: teacher hasn't auto-confirmed → "Pending confirmation" state

---

## 8. Dashboard

**Purpose:** Ongoing home base for managing lessons.

**Components:**
- Upcoming lessons list (teacher, date/time, format, join link/address, reschedule/cancel options)
- Past lessons (with "Leave a Review" prompt if not yet reviewed)
- Profile/account settings link
- Favorite/saved teachers (optional)
- Messages/notifications (optional for MVP — can be simple email-based instead)

**Fields/Data:**
- `user_id`
- Lessons list (status: upcoming/completed/cancelled)

**States:**
- No lessons yet (empty state with "Find a Teacher" CTA)
- Upcoming lessons present
- Past lessons present, review pending

---

## Cross-Cutting Notes

- **Auth persistence:** context (selected teacher/time) must survive the Sign Up/Login step — don't lose state on redirect.
- **Error/edge states:** every step with external dependency (payment, availability) needs a failure state, not just happy path.
- **Mobile-first:** assume most search/browse traffic is mobile; profile and checkout need to be thumb-friendly.
- **Reschedule/Cancel:** not in the primary flow but needed in Dashboard — define cancellation window/policy before building.
