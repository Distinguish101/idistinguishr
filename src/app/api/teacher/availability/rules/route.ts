import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthedTeacherProfile } from "@/lib/require-teacher-profile";

// Weekly recurring availability (US-26). Editing an existing slot is
// delete-then-recreate (see [id]/route.ts) rather than a PATCH — simpler
// than partial-update validation and matches the add/remove UI.

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const ruleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, "Use HH:mm"),
    endTime: z.string().regex(timeRegex, "Use HH:mm"),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export async function GET() {
  const profile = await getAuthedTeacherProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.availabilityRule.findMany({
    where: { teacherId: profile.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const profile = await getAuthedTeacherProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { dayOfWeek, startTime, endTime } = parsed.data;

  const overlapping = await prisma.availabilityRule.findFirst({
    where: {
      teacherId: profile.id,
      dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlapping) {
    return NextResponse.json(
      { error: "That overlaps with an existing slot on this day." },
      { status: 409 }
    );
  }

  const rule = await prisma.availabilityRule.create({
    data: { teacherId: profile.id, dayOfWeek, startTime, endTime },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
