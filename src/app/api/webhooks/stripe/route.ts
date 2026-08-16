import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe, platformFeeForAmount } from "@/lib/stripe";
import {
  sendBookingConfirmationEmail,
  sendTeacherReviewNeededEmail,
  sendWebhookVerificationFailedAlert,
} from "@/lib/email";
import { vetTeacherProfile } from "@/lib/vet-teacher-profile";

// Two things this app cares about:
//   - Connect account status changes: Accounts v2 doesn't deliver
//     `account.updated` the way v1 did — it fires as a "thin event"
//     (object: "v2.core.event"), a lightweight pointer rather than the
//     full resource (see stripe.com/docs/event-destinations#thin-events).
//     Thin events are a genuinely different payload/verification path
//     from classic snapshot events: `stripe.webhooks.constructEvent`
//     actively rejects them ("expects a webhook payload... use
//     stripe.parseEventNotification instead" — found by testing a real
//     payload against it), so this peeks at the unverified `object`
//     field only to pick which verifier to use, then verifies properly
//     either way. Whichever notification type fires, this re-fetches the
//     account itself rather than trusting payload contents, and reads
//     configuration.recipient.capabilities.stripe_balance.stripe_transfers.status
//     — the documented v2 way to know a connected account can actually
//     receive transfers.
//   - checkout.session.completed: confirms the booking and writes the
//     Payment record. Booking status is only ever written here, not
//     client-side — the client can't be trusted to say "payment
//     succeeded."
//
// Needs the raw request body for signature verification, so this reads
// req.text() rather than req.json() — Next's App Router route handlers
// don't auto-parse the body, so that's all that's needed (no bodyParser
// config like the old Pages Router required).

const THIN_ACCOUNT_NOTIFICATION_TYPES = [
  "v2.core.account.updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
];

async function syncStripeAccountStatus(accountId: string) {
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient"],
  });
  const status = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const stripeOnboardingComplete = status === "active";

  const profile = await prisma.teacherProfile.findFirst({
    where: { stripeAccountId: accountId },
    include: { user: { select: { fullName: true, email: true } } },
  });
  if (!profile) return;

  await prisma.teacherProfile.update({
    where: { id: profile.id },
    data: { stripeOnboardingComplete },
  });

  // Run the automated first-pass review (src/lib/vet-teacher-profile.ts)
  // right as onboarding completes, only once per teacher (the "wasn't
  // already complete" check) and only if a human hasn't already acted
  // (still PENDING) — the manual /admin approve/reject flow is untouched
  // and takes precedence either way.
  if (stripeOnboardingComplete && !profile.stripeOnboardingComplete && profile.approvalStatus === "PENDING") {
    const result = await vetTeacherProfile({
      bio: profile.bio,
      instruments: profile.instruments,
      hourlyRateMinorUnits: profile.hourlyRateMinorUnits,
      credentials: profile.credentials,
      formatsOffered: profile.formatsOffered,
      locationText: profile.locationText,
    });

    if (result.verdict === "approve") {
      await prisma.teacherProfile.update({ where: { id: profile.id }, data: { approvalStatus: "APPROVED" } });
    } else {
      await sendTeacherReviewNeededEmail({
        teacherName: profile.user.fullName,
        teacherEmail: profile.user.email,
        reason: result.reason,
      });
    }
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  // stripe listen relays both event types through one local tunnel and
  // prints a single secret, but real endpoints each get their own signing
  // secret — a classic webhook_endpoint and a v2 event_destination are
  // separate objects even when they point at the same URL. Falls back to
  // STRIPE_WEBHOOK_SECRET for both when only one is set (local dev).
  const classicSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const thinSecret = process.env.STRIPE_THIN_WEBHOOK_SECRET ?? classicSecret;
  if (!classicSecret) {
    // Real misconfiguration (env var deleted/unset), not just a request
    // missing a header — worth paging someone about.
    await sendWebhookVerificationFailedAlert({ path: "config", reason: "STRIPE_WEBHOOK_SECRET is not set" });
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }
  if (!signature) {
    // No stripe-signature header at all — this is a public URL, so this
    // is ordinary internet noise (scanners, stray bots) far more often
    // than a real problem. Not alert-worthy.
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const body = await req.text();

  // Unverified peek, used only to route to the right verifier below —
  // every field actually acted on still comes from a signature-checked parse.
  let isThinEvent = false;
  try {
    isThinEvent = JSON.parse(body)?.object === "v2.core.event";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isThinEvent) {
    if (!thinSecret) {
      await sendWebhookVerificationFailedAlert({ path: "config", reason: "STRIPE_THIN_WEBHOOK_SECRET is not set" });
      return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
    }
    let notification: Stripe.V2.Core.EventNotification;
    try {
      notification = stripe.parseEventNotification(body, signature, thinSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      // This exact branch is what let a stale STRIPE_THIN_WEBHOOK_SECRET
      // go unnoticed for over a week — see build log §24. A real
      // stripe-signature header arrived and still didn't verify, so this
      // is a config problem, not request noise.
      await sendWebhookVerificationFailedAlert({ path: "thin", reason: message });
      return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
    }

    if (THIN_ACCOUNT_NOTIFICATION_TYPES.includes(notification.type) && "related_object" in notification) {
      const accountId = notification.related_object?.id;
      if (accountId) await syncStripeAccountStatus(accountId);
    }
    return NextResponse.json({ received: true });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, classicSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    await sendWebhookVerificationFailedAlert({ path: "classic", reason: message });
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const accountId = (event.data.object as Stripe.Account).id;
      await syncStripeAccountStatus(accountId);
      break;
    }

    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const bookingId = checkoutSession.metadata?.bookingId;
      if (!bookingId) break;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          student: { select: { fullName: true, email: true } },
          teacher: { include: { user: { select: { fullName: true } } } },
        },
      });
      if (!booking || booking.status !== "PENDING_PAYMENT") break;

      const amount = checkoutSession.amount_total ?? booking.priceTotalMinorUnits;
      const platformFee = platformFeeForAmount(amount);
      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null;

      try {
        await prisma.$transaction([
          prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } }),
          prisma.payment.create({
            data: {
              bookingId: booking.id,
              amountMinorUnits: amount,
              currency: (checkoutSession.currency ?? "gbp").toUpperCase(),
              stripePaymentIntentId: paymentIntentId ?? "",
              platformFeeMinorUnits: platformFee,
              teacherPayoutMinorUnits: amount - platformFee,
              status: "SUCCEEDED",
            },
          }),
        ]);
      } catch (err) {
        // Stripe retries webhook delivery — a unique-constraint hit on
        // Payment.bookingId just means we already processed this one.
        // Skip the email too in that case (falls through to `break`).
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        break;
      }

      await sendBookingConfirmationEmail({
        to: booking.student.email,
        studentName: booking.student.fullName,
        teacherName: booking.teacher.user.fullName,
        lessonDate: booking.lessonDate,
        startTime: booking.startTime,
        durationMinutes: booking.durationMinutes,
        format: booking.format,
        locationText: booking.teacher.locationText,
        priceTotalMinorUnits: amount,
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
