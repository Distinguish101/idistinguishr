import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBookableSlots } from "@/lib/booking-slots";

const ALLOWED_DURATIONS = [30, 45, 60];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const duration = Number(searchParams.get("duration") ?? "60");

  if (!ALLOWED_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const teacher = await prisma.teacherProfile.findUnique({ where: { id } });
  if (!teacher || teacher.approvalStatus !== "APPROVED" || !teacher.stripeOnboardingComplete) {
    return NextResponse.json({ error: "Teacher not bookable" }, { status: 404 });
  }

  const slots = await getBookableSlots(id, duration, 14);
  return NextResponse.json({ slots });
}
