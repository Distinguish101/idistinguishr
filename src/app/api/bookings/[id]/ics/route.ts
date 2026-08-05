import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBookingIcs } from "@/lib/ics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { teacher: { include: { user: { select: { fullName: true } } } } },
  });

  if (!booking || booking.studentId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "This booking isn't confirmed." }, { status: 400 });
  }

  const ics = generateBookingIcs({
    uid: booking.id,
    teacherName: booking.teacher.user.fullName,
    lessonDate: booking.lessonDate,
    startTime: booking.startTime,
    durationMinutes: booking.durationMinutes,
    format: booking.format,
    locationText: booking.teacher.locationText,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lesson.ics"',
    },
  });
}
