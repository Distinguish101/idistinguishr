// SCREEN 4 — Select Time Slot
// Covers: US-09 (pick real availability), US-10 (length/format), US-11 (price preview)
// Reference mockup: mockups.html → #timeselect
// Reference spec: booking-flow-spec.md → "4. Select Time Slot"
//
// No auth required to browse/select here — per US-12, the account only
// gets created after a time is picked. The actual PENDING_PAYMENT hold
// (see src/app/api/bookings/route.ts) only happens once we have a
// studentId to attach it to, which for a signed-in user is immediate and
// for a new user happens right after they sign up (src/app/auth/AuthForm.tsx).

import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SlotPicker } from "./SlotPicker";

export default async function TimeSelectPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  const session = await auth();

  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { user: { select: { fullName: true } } },
  });

  if (!teacher || teacher.approvalStatus !== "APPROVED" || !teacher.stripeOnboardingComplete) {
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

  return (
    <main className="cal-shell">
      <div className="flow-context">
        <span>Booking {teacher.user.fullName}</span>
        <span className="t">£{(teacher.hourlyRateMinorUnits / 100).toFixed(0)}/hr</span>
      </div>
      <h1 className="t-display-l" style={{ marginBottom: 20 }}>
        Choose a date
      </h1>
      <SlotPicker
        teacherId={teacher.id}
        teacherName={teacher.user.fullName}
        hourlyRateMinorUnits={teacher.hourlyRateMinorUnits}
        formatsOffered={teacher.formatsOffered}
        locationText={teacher.locationText}
        isAuthenticated={Boolean(session?.user)}
        isStudent={session?.user ? session.user.role === "STUDENT" : true}
      />
    </main>
  );
}
