import { prisma } from "@/lib/prisma";

// Lazily transitions CONFIRMED bookings whose lesson date has fully
// passed to COMPLETED. There's no lesson-attendance-confirmation step in
// this MVP, so "the calendar date has passed" is treated as "the lesson
// happened" — same check-on-query philosophy as the booking-hold expiry
// (src/lib/booking-slots.ts) rather than a cron job. Scoped to one
// student since the Dashboard is the only caller.
export async function completePastBookings(studentId: string) {
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  await prisma.booking.updateMany({
    where: { studentId, status: "CONFIRMED", lessonDate: { lt: todayStart } },
    data: { status: "COMPLETED" },
  });
}
