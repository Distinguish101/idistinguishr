// SCREEN 7 — Booking Confirmation
// Covers: US-18 (confirmation), US-19 (add to calendar), US-20 (email confirmation)
// Reference mockup: mockups.html → #confirm
// Reference spec: booking-flow-spec.md → "7. Booking Confirmation"
//
// No side effects on load — the confirmation email is sent from the
// checkout.session.completed webhook handler (src/app/api/webhooks/stripe),
// not here. This page only ever reflects state.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
  });

  if (!booking || booking.studentId !== session.user.id) {
    return (
      <main className="confirm-shell">
        <h1 className="t-display-l">Booking not found</h1>
        <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          Go to Dashboard
        </Link>
      </main>
    );
  }

  if (booking.status === "PENDING_PAYMENT") {
    return (
      <main className="confirm-shell">
        <h1 className="t-display-l">Finalizing your payment…</h1>
        <p className="t-soft" style={{ marginTop: 12 }}>
          This usually only takes a few seconds. Refresh this page if it doesn&apos;t update.
        </p>
      </main>
    );
  }

  if (booking.status === "CANCELLED") {
    return (
      <main className="confirm-shell">
        <h1 className="t-display-l">This booking was cancelled</h1>
        <Link href="/results" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          Browse teachers
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
    <main className="confirm-shell">
      <div className="check">✓</div>
      <h1 className="t-display-l">You&apos;re booked!</h1>
      <p className="t-soft" style={{ marginTop: 8 }}>
        A confirmation has been sent to your email.
      </p>

      <div className="confirm-card">
        <div className="confirm-row">
          <span>Teacher</span>
          <span>{booking.teacher.user.fullName}</span>
        </div>
        <div className="confirm-row">
          <span>Date</span>
          <span>{dateLabel}</span>
        </div>
        <div className="confirm-row">
          <span>Time</span>
          <span>{booking.startTime}</span>
        </div>
        <div className="confirm-row">
          <span>Duration</span>
          <span>{booking.durationMinutes} min</span>
        </div>
        <div className="confirm-row">
          <span>Format</span>
          <span>{booking.format === "ONLINE" ? "Online" : booking.teacher.locationText ?? "In person"}</span>
        </div>
        <div className="confirm-row">
          <span>Total paid</span>
          <span>£{(booking.priceTotalMinorUnits / 100).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
        <a href={`/api/bookings/${booking.id}/ics`} className="btn btn-secondary">
          Add to Calendar
        </a>
        <Link href="/dashboard" className="btn btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
