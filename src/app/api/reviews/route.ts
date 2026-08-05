import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// US-23: only reviewable once a booking is COMPLETED (enforced here, not
// just in the UI), and only once per booking (Review.bookingId is unique
// at the DB level too, so a race would still be caught).
const schema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { bookingId, rating, comment } = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { review: true } });
  if (!booking || booking.studentId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "You can only review completed lessons." }, { status: 400 });
  }
  if (booking.review) {
    return NextResponse.json({ error: "You've already reviewed this lesson." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        bookingId: booking.id,
        studentId: booking.studentId,
        teacherId: booking.teacherId,
        rating,
        comment: comment || null,
      },
    });

    // Denormalized avgRating/reviewCount on TeacherProfile, recalculated
    // on every new review per the data model doc — cheap at MVP review
    // volumes, no need for an incremental running-average trick.
    const agg = await tx.review.aggregate({
      where: { teacherId: booking.teacherId },
      _avg: { rating: true },
      _count: true,
    });

    await tx.teacherProfile.update({
      where: { id: booking.teacherId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
