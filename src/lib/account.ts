import { prisma } from "@/lib/prisma";

// Confirmed lessons that haven't happened yet, for this user as a student or
// (if they're an instructor) as the teacher. Deactivating or deleting with
// these outstanding would strand the other person, so both are blocked until
// the lessons are cancelled or done.
export async function upcomingLessonCount(userId: string): Promise<number> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return prisma.booking.count({
    where: {
      status: "CONFIRMED",
      lessonDate: { gte: today },
      OR: [{ studentId: userId }, { teacher: { userId } }],
    },
  });
}

export const UPCOMING_LESSONS_MESSAGE =
  "You have upcoming lessons. Cancel them, or wait until they're done, before changing your account.";
