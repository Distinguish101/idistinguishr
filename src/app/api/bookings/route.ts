import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBookableSlots, HOLD_EXPIRY_MINUTES } from "@/lib/booking-slots";

// Creates the "soft hold" (US-32/US-33): a PENDING_PAYMENT booking that
// occupies the slot immediately, before any payment exists. Two things
// make the race condition in US-32's AC resolve to one clean winner:
//   1. Before inserting, any PENDING_PAYMENT row at the exact same
//      teacher/date/time older than HOLD_EXPIRY_MINUTES is expired
//      (cancelled) first — this is the "check-on-query" release from
//      US-33, since there's no background job.
//   2. The insert itself is protected by a DB-level partial unique index
//      (see the migration in prisma/migrations) on
//      (teacherId, lessonDate, startTime) for any non-cancelled booking.
//      Two concurrent requests for the same slot will both pass the slot
//      list check, but only one insert can win — the loser gets a 409.
// Both steps run in one transaction so the expire-then-create is atomic.

const bookingSchema = z.object({
  teacherId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  durationMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  format: z.enum(["ONLINE", "IN_PERSON"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to book a lesson." }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Only students can book lessons." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { teacherId, date, startTime, durationMinutes, format } = parsed.data;

  const teacher = await prisma.teacherProfile.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.approvalStatus !== "APPROVED" || !teacher.stripeOnboardingComplete) {
    return NextResponse.json({ error: "This teacher isn't bookable right now." }, { status: 404 });
  }
  if (!teacher.formatsOffered.includes(format)) {
    return NextResponse.json({ error: "This teacher doesn't offer that format." }, { status: 400 });
  }

  // Re-validate server-side against freshly computed slots rather than
  // trusting the client's earlier fetch — the authoritative check for
  // "is this slot actually open" (rules/exceptions/existing bookings/past
  // time all folded in already).
  const slots = await getBookableSlots(teacherId, durationMinutes, 14);
  const stillOpen = slots.some((s) => s.date === date && s.startTime === startTime);
  if (!stillOpen) {
    return NextResponse.json(
      { error: "That slot isn't available anymore — pick another time." },
      { status: 409 }
    );
  }

  const priceTotalMinorUnits = Math.round((teacher.hourlyRateMinorUnits * durationMinutes) / 60);
  const lessonDate = new Date(date);
  const holdCutoff = new Date(Date.now() - HOLD_EXPIRY_MINUTES * 60_000);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: {
          teacherId,
          lessonDate,
          startTime,
          status: "PENDING_PAYMENT",
          createdAt: { lt: holdCutoff },
        },
        data: { status: "CANCELLED", cancelledBy: "SYSTEM", cancelledAt: new Date() },
      });

      return tx.booking.create({
        data: {
          studentId: session.user.id,
          teacherId,
          lessonDate,
          startTime,
          durationMinutes,
          format,
          priceTotalMinorUnits,
        },
      });
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "That slot was just taken — pick another time." },
        { status: 409 }
      );
    }
    throw err;
  }
}
