import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upcomingLessonCount } from "@/lib/account";
import { AccountActions } from "./AccountActions";

export const metadata = { title: "Account — IDistinguishR" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const [user, upcoming] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, email: true, passwordHash: true, role: true },
    }),
    upcomingLessonCount(session.user.id),
  ]);
  if (!user) redirect("/auth");

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 640 }}>
      <span className="eyebrow">Account</span>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        {user.fullName}
      </h1>
      <p style={{ marginTop: 0, color: "var(--text-soft)" }}>{user.email}</p>

      <AccountActions
        hasPassword={Boolean(user.passwordHash)}
        isInstructor={user.role === "TEACHER"}
        upcomingLessons={upcoming}
      />
    </main>
  );
}
