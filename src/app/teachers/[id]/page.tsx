// SCREEN 3 — Teacher Profile
// Covers: US-06 (bio/credentials/rate), US-07 (reviews), US-08 (availability preview)
// Reference mockup: mockups.html → #profile
// Reference spec: booking-flow-spec.md → "3. Teacher Profile"

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUpcomingAvailability } from "@/lib/availability";
import { ProfileTabs } from "./ProfileTabs";

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

        <ProfileTabs
          bio={teacher.bio}
          credentialLines={credentialLines}
          reviews={reviews}
          reviewCount={teacher.reviewCount}
          nextDates={nextDates}
        />
      </div>

      <div className="sidebar-card">
        <span className="eyebrow">From</span>
        <div className="price-lg">
          £{(teacher.hourlyRateMinorUnits / 100).toFixed(0)} <span>/ hour</span>
        </div>
        {nextDates.length > 0 ? (
          <p className="p-next-avail">
            <span className="dot" />
            Next available:{" "}
            {new Date(nextDates[0]).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}
          </p>
        ) : (
          <p className="t-soft" style={{ fontSize: 13, marginTop: 10 }}>
            No open slots in the next two weeks.
          </p>
        )}
        <Link href={`/book/${teacher.id}`} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          Select a Time
        </Link>
      </div>
    </main>
  );
}
