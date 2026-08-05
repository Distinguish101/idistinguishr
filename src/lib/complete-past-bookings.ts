import { prisma } from "@/lib/prisma";

// Lazily transitions CONFIRMED bookings whose lesson date has fully
// passed to COMPLETED. There's no lesson-attendance-confirmation step in
// this MVP, so "the calendar date has passed" is treated as "the lesson
// happened" — same check-on-query philosophy as the booking-hold expiry
// (src/lib/booking-slots.ts) rather than a cron job.
//
// Unscoped (not filtered to one student/teacher) — both the student and
// teacher dashboards call this on load, and whichever side happens to
// look first should see correct state. A table-wide updateMany here is
// cheap at MVP data volumes; narrowing it isn't worth the complexity of
// tracking which side already ran it.
export async function completePastBookings() {
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  await prisma.booking.updateMany({
    where: { status: "CONFIRMED", lessonDate: { lt: todayStart } },
    data: { status: "COMPLETED" },
  });
}
