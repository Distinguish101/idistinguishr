import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeInstruments } from "@/lib/instruments";
import { deletePhotoByUrl, storageConfig, userPhotoPrefix } from "@/lib/storage";

// Teacher profile CRUD (US-25). Create/update share one endpoint since
// TeacherProfile is 1:1 with a teacher User — an upsert on userId covers
// both "first time" and "editing" without a separate create route.

const profileSchema = z
  .object({
    bio: z.string().trim().min(20, "Bio should be at least 20 characters.").max(2000),
    // Stored in canonical lowercase form (see lib/instruments.ts): Prisma's
    // array `has` is an exact, case-sensitive match, so mixed casing would
    // split one instrument into several in search and the homepage list.
    instruments: z
      .array(z.string().trim().min(1))
      .min(1, "Add at least one instrument.")
      .max(10)
      .transform(normalizeInstruments),
    hourlyRate: z.number().positive().max(500),
    formatsOffered: z.array(z.enum(["ONLINE", "IN_PERSON"])).min(1, "Offer at least one format."),
    locationText: z.string().trim().max(200).nullable(),
    credentials: z.string().trim().min(10, "Add a bit more detail on your credentials.").max(2000),
    photoUrl: z.string().trim().url("Enter a valid URL.").max(2000).nullable().optional(),
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
  const { bio, instruments, hourlyRate, formatsOffered, locationText, credentials, photoUrl } = parsed.data;
  const hourlyRateMinorUnits = Math.round(hourlyRate * 100);

  // Once photo uploads are on, a photo must be one this instructor uploaded
  // (or the link they already have), not an arbitrary web address.
  const existing = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { photoUrl: true },
  });
  const cfg = storageConfig();
  if (cfg && photoUrl && photoUrl !== existing?.photoUrl && !photoUrl.startsWith(userPhotoPrefix(cfg, session.user.id))) {
    return NextResponse.json({ error: "Please add your photo with the Upload button." }, { status: 400 });
  }

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
      photoUrl,
    },
    update: {
      bio,
      instruments,
      hourlyRateMinorUnits,
      formatsOffered,
      locationText,
      credentials,
      photoUrl,
    },
  });

  // A replaced or removed photo of ours is deleted from storage (best-effort).
  if (existing?.photoUrl && existing.photoUrl !== (photoUrl ?? null)) {
    await deletePhotoByUrl(existing.photoUrl);
  }

  return NextResponse.json({ profile });
}
