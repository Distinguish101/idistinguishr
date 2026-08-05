// Teacher-facing dashboard — US-27 (upcoming/past lessons), US-28 (earnings/payout status).
// Not one of the 8 numbered student-flow screens (same situation as the
// teacher profile/availability pages) — read-only schedule view, no
// cancel action here since neither user story asks for one on this side.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completePastBookings } from "@/lib/complete-past-bookings";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TEACHER") redirect("/dashboard");

  const profile = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/teacher/profile");

  await completePastBookings();

  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = tabParam === "past" ? "past" : "upcoming";

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [bookings, totalBookings, earnings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        teacherId: profile.id,
        status: tab === "upcoming" ? "CONFIRMED" : { in: ["COMPLETED", "CANCELLED"] },
        ...(tab === "upcoming" ? { lessonDate: { gte: todayStart } } : {}),
      },
      include: { student: { select: { fullName: true } } },
      orderBy: { lessonDate: tab === "upcoming" ? "asc" : "desc" },
    }),
    prisma.booking.count({
      where: { teacherId: profile.id, status: { not: "PENDING_PAYMENT" } },
    }),
    prisma.payment.aggregate({
      where: { booking: { teacherId: profile.id }, status: "SUCCEEDED" },
      _sum: { teacherPayoutMinorUnits: true },
      _count: true,
    }),
  ]);

  const totalEarnedMinorUnits = earnings._sum.teacherPayoutMinorUnits ?? 0;

  return (
    <main className="wrap dash-shell">
      <span className="eyebrow">US-27 / US-28</span>
      <h1 className="t-display-l">Your teaching dashboard</h1>

      <div className="card" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 className="t-display-m" style={{ marginBottom: 8 }}>
          Earnings
        </h2>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, margin: 0 }}>
          £{(totalEarnedMinorUnits / 100).toFixed(2)}
        </p>
        <p className="t-soft" style={{ fontSize: 13, marginTop: 4 }}>
          from {earnings._count} paid {earnings._count === 1 ? "lesson" : "lessons"}
        </p>
        {profile.stripeOnboardingComplete ? (
          <a href="/api/stripe/dashboard-link" className="btn btn-secondary" style={{ marginTop: 16, display: "inline-block" }}>
            View payouts in Stripe
          </a>
        ) : (
          <p className="t-soft" style={{ fontSize: 13, marginTop: 16 }}>
            Connect Stripe from your{" "}
            <Link href="/teacher/profile" style={{ textDecoration: "underline" }}>
              profile
            </Link>{" "}
            to see your payout schedule.
          </p>
        )}
      </div>

      <div className="dash-tabs">
        <Link href="/teacher/dashboard?tab=upcoming">
          <span className={tab === "upcoming" ? "sel" : ""}>Upcoming</span>
        </Link>
        <Link href="/teacher/dashboard?tab=past">
          <span className={tab === "past" ? "sel" : ""}>Past</span>
        </Link>
      </div>

      {totalBookings === 0 ? (
        <div className="empty-state">
          <p>No lessons booked yet.</p>
        </div>
      ) : bookings.length === 0 ? (
        <p className="t-soft">Nothing here yet.</p>
      ) : (
        bookings.map((b) => (
          <div key={b.id} className="lesson-row">
            <div className="lesson-date">
              <div className="d">{b.lessonDate.getUTCDate()}</div>
              <div className="m">
                {b.lessonDate.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
              </div>
            </div>
            <div className="lesson-info">
              <div className="who">{b.student.fullName}</div>
              <div className="when">
                {b.startTime} · {b.durationMinutes} min ·{" "}
                {b.format === "ONLINE" ? "Online" : profile.locationText ?? "In person"}
              </div>
              {b.status === "CANCELLED" && (
                <span className="badge badge-rejected" style={{ marginTop: 6, display: "inline-block" }}>
                  Cancelled
                </span>
              )}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>
              £{(b.priceTotalMinorUnits / 100).toFixed(2)}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
