import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Teacher profile CRUD (US-25). Create/update share one endpoint since
// TeacherProfile is 1:1 with a teacher User — an upsert on userId covers
// both "first time" and "editing" without a separate create route.

const profileSchema = z
  .object({
    bio: z.string().trim().min(20, "Bio should be at least 20 characters.").max(2000),
    instruments: z.array(z.string().trim().min(1)).min(1, "Add at least one instrument.").max(10),
    hourlyRate: z.number().positive().max(500),
    formatsOffered: z.array(z.enum(["ONLINE", "IN_PERSON"])).min(1, "Offer at least one format."),
    locationText: z.string().trim().max(200).nullable(),
    credentials: z.string().trim().min(10, "Add a bit more detail on your credentials.").max(2000),
  })
  .refine((data) => !data.formatsOffered.includes("IN_PERSON") || !!data.locationText, {
    message: "Add a location for in-person lessons.",
    path: ["locationText"],
  });

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { bio, instruments, hourlyRate, formatsOffered, locationText, credentials } = parsed.data;
  const hourlyRateMinorUnits = Math.round(hourlyRate * 100);

  const profile = await prisma.teacherProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      bio,
      instruments,
      hourlyRateMinorUnits,
      formatsOffered,
      locationText,
      credentials,
    },
    update: {
      bio,
      instruments,
      hourlyRateMinorUnits,
      formatsOffered,
      locationText,
      credentials,
    },
  });

  return NextResponse.json({ profile });
}
