import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, platformFeeForAmount } from "@/lib/stripe";

// Creates the Stripe Checkout Session for a PENDING_PAYMENT booking — a
// destination charge, so the student's payment splits automatically:
// the platform's application_fee_amount stays on the platform account,
// the rest transfers to the teacher's connected account. Booking.status
// only ever moves to CONFIRMED from the webhook (src/app/api/webhooks/stripe),
// once Stripe actually confirms the payment — never from this route.

const schema = z.object({ bookingId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Sign in as a student to pay for a lesson." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
  });

  if (!booking || booking.studentId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "This booking isn't awaiting payment — it may have expired or already been paid." },
      { status: 409 }
    );
  }
  if (!booking.teacher.stripeAccountId) {
    return NextResponse.json({ error: "This teacher isn't set up to receive payments yet." }, { status: 400 });
  }

  const platformFee = platformFeeForAmount(booking.priceTotalMinorUnits);
  const origin = new URL(req.url).origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: booking.priceTotalMinorUnits,
          product_data: {
            name: `Lesson with ${booking.teacher.user.fullName} — ${booking.lessonDate.toISOString().slice(0, 10)} at ${booking.startTime}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFee,
      transfer_data: { destination: booking.teacher.stripeAccountId },
    },
    metadata: { bookingId: booking.id },
    success_url: `${origin}/confirmation/${booking.id}`,
    cancel_url: `${origin}/checkout?bookingId=${booking.id}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
