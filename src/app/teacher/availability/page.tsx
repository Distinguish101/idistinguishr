// Teacher-facing availability CRUD — US-26.
// Requires a TeacherProfile to already exist (availability hangs off it),
// so no-profile-yet redirects to /teacher/profile first.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvailabilityManager } from "./AvailabilityManager";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TEACHER") redirect("/dashboard");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) redirect("/teacher/profile");

  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { teacherId: profile.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { teacherId: profile.id },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 640 }}>
      <span className="eyebrow">US-26</span>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Your availability
      </h1>
      <p className="t-soft" style={{ marginBottom: 24 }}>
        Set your recurring weekly hours, then block or add one-off exceptions.
      </p>
      <AvailabilityManager
        initialRules={rules}
        initialExceptions={exceptions.map((e) => ({
          ...e,
          date: e.date.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}
