import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe, platformFeeForAmount } from "@/lib/stripe";

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
  await prisma.teacherProfile.updateMany({
    where: { stripeAccountId: accountId },
    data: { stripeOnboardingComplete: status === "active" },
  });
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
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
    let notification: Stripe.V2.Core.EventNotification;
    try {
      notification = stripe.parseEventNotification(body, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
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
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
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

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
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
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
