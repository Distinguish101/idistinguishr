import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthedTeacherProfile } from "@/lib/require-teacher-profile";

// One-off overrides on top of the weekly rules (US-26 / data-model.md).
// null start/end means the whole day (fully blocked, or open for BLOCKED
// vs ADDED respectively) — both must be null or both set, never one.

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const exceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    type: z.enum(["BLOCKED", "ADDED"]),
    startTime: z.string().regex(timeRegex, "Use HH:mm").nullable(),
    endTime: z.string().regex(timeRegex, "Use HH:mm").nullable(),
  })
  .refine((d) => (d.startTime === null) === (d.endTime === null), {
    message: "Provide both start and end time, or leave both blank for all day.",
    path: ["endTime"],
  })
  .refine((d) => d.startTime === null || d.startTime < d.endTime!, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

function serialize(exception: { date: Date } & Record<string, unknown>) {
  return { ...exception, date: exception.date.toISOString().slice(0, 10) };
}

export async function GET() {
  const profile = await getAuthedTeacherProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exceptions = await prisma.availabilityException.findMany({
    where: { teacherId: profile.id },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ exceptions: exceptions.map(serialize) });
}

export async function POST(req: Request) {
  const profile = await getAuthedTeacherProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = exceptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { date, type, startTime, endTime } = parsed.data;

  const exception = await prisma.availabilityException.create({
    data: { teacherId: profile.id, date: new Date(date), type, startTime, endTime },
  });
  return NextResponse.json({ exception: serialize(exception) }, { status: 201 });
}
