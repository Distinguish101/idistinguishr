// SCREEN 5 — Sign Up / Login
// Covers: US-12 (signup after time selection), US-13 (login), US-14 (OAuth)
// Reference mockup: mockups.html → #auth
// Reference spec: booking-flow-spec.md → "5. Sign Up / Login"
//
// Booking context (teacherId/date/startTime/duration/format) arrives via
// query params from the Select Time Slot page's "Continue" button when
// there's no session yet — see src/app/book/[teacherId]/SlotPicker.tsx.
// The actual hold isn't created here; AuthForm does that after a
// successful sign-in, once there's a studentId to attach it to.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthForm } from "./AuthForm";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "TEACHER" ? "/teacher/profile" : "/dashboard");
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);

  const sp = await searchParams;
  const teacherId = first(sp.teacherId);
  const date = first(sp.date);
  const startTime = first(sp.startTime);
  const duration = first(sp.duration);
  const format = first(sp.format);

  let bookingContext: {
    teacherId: string;
    teacherName: string;
    date: string;
    startTime: string;
    duration: number;
    format: "ONLINE" | "IN_PERSON";
  } | null = null;

  if (teacherId && date && startTime && duration && (format === "ONLINE" || format === "IN_PERSON")) {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: teacherId },
      select: { user: { select: { fullName: true } } },
    });
    if (teacher) {
      bookingContext = { teacherId, teacherName: teacher.user.fullName, date, startTime, duration: Number(duration), format };
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        {bookingContext && (
          <div className="booking-banner">
            Booking {bookingContext.teacherName} —{" "}
            {new Date(bookingContext.date).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}{" "}
            at {bookingContext.startTime}
          </div>
        )}
        <span className="eyebrow">Sign up or log in</span>
        <h1 className="t-display-l" style={{ marginBottom: 20 }}>
          IDistinguishR
        </h1>
        <AuthForm googleEnabled={googleEnabled} bookingContext={bookingContext} />
      </div>
    </main>
  );
}
