// SCREEN 8 — Dashboard
// Covers: US-21 (upcoming), US-22 (reschedule/cancel), US-23 (leave review), US-24 (empty state)
// Reference mockup: mockups.html → #dashboard
// Reference spec: booking-flow-spec.md → "8. Dashboard"
//
// "Reschedule" isn't a modeled operation anywhere in the schema (no field
// for it, and the data model doc explicitly scopes bookings to single
// lessons with no recurring/reschedule concept) — cancelling and booking
// a fresh time achieves the same result, so only Cancel is built here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completePastBookings } from "@/lib/complete-past-bookings";
import { CancelButton } from "./CancelButton";
import { ReviewForm } from "./ReviewForm";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role === "TEACHER") redirect("/teacher/profile");

  await completePastBookings();

  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = tabParam === "past" ? "past" : "upcoming";

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [bookings, totalBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        studentId: session.user.id,
        status: tab === "upcoming" ? "CONFIRMED" : { in: ["COMPLETED", "CANCELLED"] },
        ...(tab === "upcoming" ? { lessonDate: { gte: todayStart } } : {}),
      },
      include: {
        teacher: { include: { user: { select: { fullName: true } } } },
        review: true,
      },
      orderBy: { lessonDate: tab === "upcoming" ? "asc" : "desc" },
    }),
    prisma.booking.count({
      where: { studentId: session.user.id, status: { not: "PENDING_PAYMENT" } },
    }),
  ]);

  return (
    <main className="wrap dash-shell">
      <span className="eyebrow">US-21</span>
      <h1 className="t-display-l">Your lessons</h1>

      <div className="dash-tabs">
        <Link href="/dashboard?tab=upcoming">
          <span className={tab === "upcoming" ? "sel" : ""}>Upcoming</span>
        </Link>
        <Link href="/dashboard?tab=past">
          <span className={tab === "past" ? "sel" : ""}>Past</span>
        </Link>
      </div>

      {totalBookings === 0 ? (
        <div className="empty-state">
          <p>No lessons yet — find a teacher and book your first one.</p>
          <Link href="/results" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
            Find a Teacher
          </Link>
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
              <div className="who">{b.teacher.user.fullName}</div>
              <div className="when">
                {b.startTime} · {b.durationMinutes} min ·{" "}
                {b.format === "ONLINE" ? "Online" : b.teacher.locationText ?? "In person"}
              </div>
              {b.status === "CANCELLED" && (
                <span className="badge badge-rejected" style={{ marginTop: 6, display: "inline-block" }}>
                  Cancelled
                </span>
              )}
            </div>
            <div>
              {tab === "upcoming" && <CancelButton bookingId={b.id} />}
              {tab === "past" && b.status === "COMPLETED" && !b.review && <ReviewForm bookingId={b.id} />}
              {tab === "past" && b.status === "COMPLETED" && b.review && (
                <span className="t-soft" style={{ fontSize: 12 }}>
                  Reviewed
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
