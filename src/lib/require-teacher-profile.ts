import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Shared by the availability route handlers: resolves the signed-in
// teacher's own TeacherProfile, or null if unauthenticated/wrong role/no
// profile yet. Callers just check for null and return 401.
export async function getAuthedTeacherProfile() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") return null;
  return prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
}
