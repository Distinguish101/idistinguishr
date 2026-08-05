// SCREEN 6 — Payment / Checkout
// Covers: US-15 (order summary), US-16 (payment + failure handling), US-17 (cancellation policy)
// Reference mockup: mockups.html → #payment
// Reference spec: booking-flow-spec.md → "6. Payment / Checkout"
// Reference: idistinguishr-stripe-connect-research.md
//
// Payment failure (US-16's AC) doesn't need explicit handling here: if the
// student's card fails or they abandon Stripe's hosted page, they land
// back on this same page (cancel_url) with the booking still
// PENDING_PAYMENT — no confirmed booking gets created, and the hold
// simply expires via the existing US-33 logic if never retried.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConfirmPayButton } from "./ConfirmPayButton";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const sp = await searchParams;
  const bookingIdParam = sp.bookingId;
  const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;

  if (!bookingId) {
    return (
      <main className="wrap" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 560 }}>
        <h1 className="t-display-l">No booking to check out</h1>
        <p className="t-soft" style={{ marginTop: 12 }}>
          Pick a teacher and a time first.
        </p>
        <Link href="/results" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          Browse teachers
        </Link>
      </main>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
  });

  if (!booking || booking.studentId !== session.user.id) {
    return (
      <main className="wrap" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 560 }}>
        <h1 className="t-display-l">Booking not found</h1>
        <Link href="/results" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          Browse teachers
        </Link>
      </main>
    );
  }

  if (booking.status === "CONFIRMED") {
    redirect(`/confirmation/${booking.id}`);
  }

  if (booking.status !== "PENDING_PAYMENT") {
    return (
      <main className="wrap" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 560 }}>
        <h1 className="t-display-l">This hold is no longer available</h1>
        <p className="t-soft" style={{ marginTop: 12 }}>
          It looks like this slot expired or was taken. Pick a fresh time with {booking.teacher.user.fullName}.
        </p>
        <Link
          href={`/book/${booking.teacherId}`}
          className="btn btn-primary"
          style={{ marginTop: 20, display: "inline-block" }}
        >
          Choose a new time
        </Link>
      </main>
    );
  }

  const dateLabel = booking.lessonDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <main className="flow-shell" style={{ maxWidth: 560 }}>
      <h1 className="t-display-l" style={{ marginBottom: 24 }}>
        Review &amp; pay
      </h1>

      <div className="card">
        <div className="order-row">
          <span>Teacher</span>
          <span>{booking.teacher.user.fullName}</span>
        </div>
        <div className="order-row">
          <span>Date</span>
          <span>{dateLabel}</span>
        </div>
        <div className="order-row">
          <span>Time</span>
          <span>{booking.startTime}</span>
        </div>
        <div className="order-row">
          <span>Duration</span>
          <span>{booking.durationMinutes} min</span>
        </div>
        <div className="order-row">
          <span>Format</span>
          <span>{booking.format === "ONLINE" ? "Online" : "In person"}</span>
        </div>
        <div className="order-row total">
          <span>Total</span>
          <span>£{(booking.priceTotalMinorUnits / 100).toFixed(2)}</span>
        </div>
      </div>

      <p className="t-soft" style={{ fontSize: 13, margin: "16px 0 24px" }}>
        Free cancellation up to {booking.cancellationWindowHours} hours before your lesson.
      </p>

      <ConfirmPayButton bookingId={booking.id} />
    </main>
  );
}
