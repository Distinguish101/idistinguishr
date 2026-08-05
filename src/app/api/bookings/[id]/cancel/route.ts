import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// US-22: cancellation only allowed up to `cancellationWindowHours` before
// the lesson (snapshotted per-booking at booking time, per the data
// model doc, so a later policy change doesn't retroactively affect
// existing bookings).
//
// The cutoff math treats the stored lessonDate/startTime as if they were
// UTC (Date.UTC(...)) rather than correctly resolving the actual
// Europe/London offset for that date — this can be off by up to an hour
// during BST. That's the same tradeoff the data model doc explicitly
// makes for the whole app ("UK only... removes... DST-edge-case handling
// from v1 scope entirely"), not a new shortcut introduced here.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.studentId !== session.user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Only confirmed bookings can be cancelled." }, { status: 400 });
  }

  const [h, m] = booking.startTime.split(":").map(Number);
  const lessonStart = new Date(
    Date.UTC(booking.lessonDate.getUTCFullYear(), booking.lessonDate.getUTCMonth(), booking.lessonDate.getUTCDate(), h, m)
  );
  const cutoff = new Date(lessonStart.getTime() - booking.cancellationWindowHours * 60 * 60 * 1000);

  if (new Date() >= cutoff) {
    return NextResponse.json(
      {
        error: `Too close to the lesson to cancel — free cancellation ends ${booking.cancellationWindowHours} hours before it starts.`,
      },
      { status: 400 }
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledBy: "STUDENT", cancelledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
