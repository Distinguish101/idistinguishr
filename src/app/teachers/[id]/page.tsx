// SCREEN 3 — Teacher Profile
// Covers: US-06 (bio/credentials/rate), US-07 (reviews), US-08 (availability preview)
// Reference mockup: mockups.html → #profile
// Reference spec: booking-flow-spec.md → "3. Teacher Profile"

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUpcomingAvailability } from "@/lib/availability";

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id },
    include: { user: { select: { fullName: true } } },
  });

  if (!teacher) notFound();

  // Edge case from the spec: teacher exists but isn't bookable (pending
  // approval, or Stripe onboarding incomplete) — a real 404 would be
  // misleading since the profile does exist, just isn't live yet.
  if (teacher.approvalStatus !== "APPROVED" || !teacher.stripeOnboardingComplete) {
    return (
      <main className="wrap" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 640 }}>
        <h1 className="t-display-l">This teacher isn&apos;t available right now</h1>
        <p className="t-soft" style={{ marginTop: 12 }}>
          Their profile is still being reviewed or set up. Try browsing other teachers instead.
        </p>
        <Link href="/results" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          Browse teachers
        </Link>
      </main>
    );
  }

  const [reviews, upcoming] = await Promise.all([
    prisma.review.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { student: { select: { fullName: true } } },
    }),
    getUpcomingAvailability(teacher.id, 14),
  ]);

  const nextDates = Array.from(new Set(upcoming.map((w) => w.date))).slice(0, 4);
  const credentialLines = teacher.credentials
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const locationLabel =
    teacher.formatsOffered.includes("IN_PERSON") && teacher.locationText
      ? `${teacher.locationText}${teacher.formatsOffered.includes("ONLINE") ? " & Online" : ""}`
      : "Online";

  return (
    <main className="wrap profile-grid">
      <div>
        <div className="p-photo">
          {teacher.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- teacher-submitted URL, any host
            <img src={teacher.photoUrl} alt={teacher.user.fullName} />
          )}
        </div>
        <h1 className="p-name">{teacher.user.fullName}</h1>
        <div className="p-meta">
          <span className="note-rating">
            ♪♪♪♪♪ {Number(teacher.avgRating).toFixed(1)} ({teacher.reviewCount} reviews)
          </span>
          <span>·</span>
          <span>{teacher.instruments.join(", ")}</span>
          <span>·</span>
          <span>{locationLabel}</span>
        </div>

        <div className="p-section">
          <h3>About</h3>
          <p>{teacher.bio}</p>
        </div>

        <div className="p-section">
          <h3>Experience &amp; credentials</h3>
          <ul className="cred-list">
            {credentialLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="p-section">
          <h3>Reviews</h3>
          {reviews.length === 0 ? (
            <p className="t-soft">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review">
                <div className="who">
                  {r.student.fullName} — {new Date(r.createdAt).toLocaleDateString("en-GB")}
                </div>
                {r.comment && <p>{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-card">
        <span className="eyebrow">From</span>
        <div className="price-lg">
          £{(teacher.hourlyRateMinorUnits / 100).toFixed(0)} <span>/ hour</span>
        </div>
        <div className="t-soft" style={{ fontSize: 12, marginTop: 10 }}>
          Next available
        </div>
        {nextDates.length > 0 ? (
          <div className="mini-cal">
            {nextDates.map((d) => (
              <div key={d} className="open">
                {new Date(d).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                <br />
                {new Date(d).getUTCDate()}
              </div>
            ))}
          </div>
        ) : (
          <p className="t-soft" style={{ fontSize: 13, margin: "8px 0 16px" }}>
            No open slots in the next two weeks.
          </p>
        )}
        <Link href={`/book/${teacher.id}`} className="btn btn-primary btn-block">
          Select a Time
        </Link>
      </div>
    </main>
  );
}
