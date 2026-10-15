import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forgetUserStatus } from "@/lib/user-status";
import { upcomingLessonCount, UPCOMING_LESSONS_MESSAGE } from "@/lib/account";

const schema = z.object({
  // Accounts with a password confirm with it; accounts without one (Google
  // sign-in) confirm by typing DELETE.
  password: z.string().max(72).optional(),
  confirmText: z.string().max(20).optional(),
});

// Permanent. Personal data is removed or anonymised, but bookings, payments
// and reviews are kept (the other party and the financial records still need
// them) — they just no longer point at a real name or email.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacherProfile: { select: { id: true } } },
  });
  if (!user || user.status === "DELETED") {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (user.passwordHash) {
    const ok = parsed.data.password ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }
  } else if (parsed.data.confirmText !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  if ((await upcomingLessonCount(userId)) > 0) {
    return NextResponse.json({ error: UPCOMING_LESSONS_MESSAGE }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    if (user.teacherProfile) {
      const teacherId = user.teacherProfile.id;
      await tx.availabilityRule.deleteMany({ where: { teacherId } });
      await tx.availabilityException.deleteMany({ where: { teacherId } });
      await tx.teacherProfile.update({
        where: { id: teacherId },
        data: { bio: "", credentials: "", photoUrl: null, locationText: null, approvalStatus: "REJECTED" },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        fullName: "Deleted user",
        // Frees the original address for a future sign-up; .invalid never resolves.
        email: `deleted-${userId}@deleted.invalid`,
        passwordHash: null,
      },
    });
  });
  forgetUserStatus(userId);

  return NextResponse.json({ ok: true });
}
