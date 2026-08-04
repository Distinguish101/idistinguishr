// Teacher-facing profile CRUD — US-25.
// Not one of the 8 numbered student-flow screens in mockups.html; the
// teacher stories (US-25 to US-30) don't have mockups, so this follows the
// style guide's components without a specific screen reference.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeacherProfileForm } from "./TeacherProfileForm";

export default async function TeacherProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TEACHER") redirect("/dashboard");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 640 }}>
      <span className="eyebrow">US-25</span>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Your teacher profile
      </h1>
      <p className="t-soft" style={{ marginBottom: 24 }}>
        {profile
          ? "Students see this once it's approved."
          : "Create your profile to get started — an admin reviews it before you go live."}
      </p>
      <TeacherProfileForm initial={profile} />
    </main>
  );
}
