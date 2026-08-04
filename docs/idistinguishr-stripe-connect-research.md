# Stripe Connect — Research Summary for IDistinguishR

## The short answer
Stripe Connect is the right choice. It's the standard infrastructure for two-sided marketplaces (student pays → platform takes a cut → teacher gets paid out), and for a UK-only MVP the setup is straightforward.

---

## Account type: use **Express**

Stripe Connect offers three account types:

| Type | Who controls the UX | Best for |
|---|---|---|
| **Express** | Stripe-hosted onboarding, your branding | Fast-launching marketplaces — recommended default |
| **Standard** | Teacher's own Stripe account, you just manage fees | Teachers who already have Stripe |
| **Custom** | Fully custom onboarding, you own everything | Large platforms needing full control |

<cite index="6-1">Express accounts offer fast onboarding via Stripe's interface and are ideal for small marketplaces prioritizing speed</cite>, which fits IDistinguishR at MVP stage — you get Stripe's pre-built KYC/verification flow instead of building your own identity verification.

**Recommendation: Express.** It maps directly to `teacher_profiles.approval_status` in your schema — a teacher signs up, goes through Stripe's hosted verification, and once that clears (plus your manual approval), they're bookable.

---

## How the money actually moves

For your flow (student pays for a lesson, platform takes a cut, teacher gets the rest), the standard pattern is a **destination charge**: the full amount is charged to the student, and a portion automatically transfers to the teacher's connected account, with your platform fee retained. <cite index="14-1">Destination charges and separate charges and transfers typically use the platform's pricing plan and are assessed on the platform</cite> — meaning you (the platform) are billed Stripe's processing fee, and you decide how much of that (if any) to pass on to the teacher.

Practically, this means your `payments` table entry ties to one Stripe PaymentIntent, and Stripe handles the split automatically based on the application fee you configure at charge time — you don't need a separate manual payout step.

---

## Fees to budget for (UK)

Based on current published/reported figures — **worth re-confirming exact numbers directly on Stripe's pricing page before finalizing your model**, as these change and third-party sources vary:

- **Base UK card processing fee**: roughly 1.5% + 20p per transaction for domestic UK cards.
- **Connect account fee**: a small monthly/per-active-account fee for each connected teacher account (reported around £2/month per active connected account in some sources) — confirm current rate.
- **Payout fee**: standard payouts to a UK bank account are typically included at no extra charge; faster/instant payouts cost extra.
- **Currency conversion**: not a concern for MVP since you're UK-only, single currency (GBP).

**Implication for your data model:** your `payments.amount` should store the gross amount charged to the student. Store your platform's cut and Stripe's fee separately (or compute from Stripe's reporting) if you want accurate teacher payout reconciliation — don't just store one number and try to back-calculate later.

---

## Onboarding flow (maps to your teacher signup)

1. Teacher creates an IDistinguishR account (`users` table, `role = teacher`).
2. Teacher fills in profile (`teacher_profiles`) — bio, rate, instruments.
3. Teacher is redirected to Stripe-hosted Express onboarding to verify identity and add payout bank details.
4. Stripe returns a `stripe_account_id` — add this field to `teacher_profiles`.
5. Teacher can't go live (bookable) until **both**: Stripe verification is complete AND your manual `approval_status = approved` check passes.

**Schema update needed:** add `stripe_account_id` (string) and `stripe_onboarding_complete` (boolean) to `teacher_profiles`.

---

## What this means for your MVP timeline

<cite index="7-1">Stripe Connect is the most complete managed solution for handling collecting money from buyers, splitting it between sellers and the platform, managing failed payouts, and onboarding sellers without requiring them to have existing payment accounts</cite> — so you're not building fraud checks, KYC, or payout infrastructure yourselves. That's the right tradeoff for a small team building an MVP.

Realistic scope: Stripe Connect Express integration is a well-trodden path (lots of documentation, standard patterns) — it's a few days of focused work, not a major R&D effort, provided you don't try to customize the onboarding UI.

---

## Open item to confirm before build

Exact current fee figures (percentage + fixed fee, connected account fee, payout fee) should be pulled fresh from **stripe.com/connect/pricing** at build time — pricing pages update periodically and the figures above are directional, not contractual.
