import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forgetUserStatus } from "@/lib/user-status";
import { upcomingLessonCount, UPCOMING_LESSONS_MESSAGE } from "@/lib/account";

// Reversible: the account is switched off (instructors disappear from search
// and booking) and signing in again with the password switches it back on.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  if ((await upcomingLessonCount(userId)) > 0) {
    return NextResponse.json({ error: UPCOMING_LESSONS_MESSAGE }, { status: 409 });
  }

  await prisma.user.update({ where: { id: userId }, data: { status: "DEACTIVATED" } });
  forgetUserStatus(userId);

  return NextResponse.json({ ok: true });
}
