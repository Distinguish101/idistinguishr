import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared onboarding@resend.dev sender works without verifying a
// domain, but in that mode only delivers to the Resend account's own
// email — fine for confirming the integration works, not for real
// students. Swap in a verified domain's address when that's set up.
const FROM = "IDistinguishR <onboarding@resend.dev>";

// No existing "site URL" env var in this app (every other link is a
// relative next/link) — this is the one email that needs an absolute URL,
// since it's read outside the browser.
const SITE_URL = process.env.SITE_URL ?? "https://idistinguishr.vercel.app";

export async function sendBookingConfirmationEmail(params: {
  to: string;
  studentName: string;
  teacherName: string;
  lessonDate: Date;
  startTime: string;
  durationMinutes: number;
  format: "ONLINE" | "IN_PERSON";
  locationText: string | null;
  priceTotalMinorUnits: number;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping confirmation email");
    return;
  }

  const dateLabel = params.lessonDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const formatLabel = params.format === "ONLINE" ? "Online" : params.locationText ?? "In person";
  const price = (params.priceTotalMinorUnits / 100).toFixed(2);

  try {
    await resend.emails.send({
      from: FROM,
      to: [params.to],
      subject: `You're booked with ${params.teacherName} — ${dateLabel}`,
      html: `
        <p>Hi ${params.studentName},</p>
        <p>Your lesson with <strong>${params.teacherName}</strong> is confirmed.</p>
        <ul>
          <li><strong>Date:</strong> ${dateLabel}</li>
          <li><strong>Time:</strong> ${params.startTime}</li>
          <li><strong>Duration:</strong> ${params.durationMinutes} min</li>
          <li><strong>Format:</strong> ${formatLabel}</li>
          <li><strong>Total paid:</strong> £${price}</li>
        </ul>
        <p>Free cancellation up to 48 hours before your lesson, from your dashboard.</p>
      `,
    });
  } catch (err) {
    // The payment already succeeded by this point — an email failure
    // shouldn't undo that or fail the webhook (Stripe would just retry
    // it, re-charging nothing but re-attempting a Payment row that
    // already exists). Log and move on.
    console.error("Failed to send booking confirmation email:", err);
  }
}

// Sent when a teacher finishes Stripe onboarding but automated vetting
// (src/lib/vet-teacher-profile.ts) didn't approve them outright — the
// teacher stays PENDING exactly as before that feature existed; this just
// makes sure an admin finds out without having to check /admin on a timer.
export async function sendTeacherReviewNeededEmail(params: {
  teacherName: string;
  teacherEmail: string;
  reason: string;
}) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!resend || adminEmails.length === 0) {
    console.warn("RESEND_API_KEY or ADMIN_EMAILS not set — skipping teacher review notification");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: adminEmails,
      subject: `Teacher profile needs review — ${params.teacherName}`,
      html: `
        <p>${params.teacherName} (${params.teacherEmail}) finished Stripe onboarding, but the automated
        first-pass review didn't approve them outright:</p>
        <p><em>${params.reason}</em></p>
        <p>They're still sitting in Pending — take a look on <a href="${SITE_URL}/admin">/admin</a> when you get a chance.</p>
      `,
    });
  } catch (err) {
    // Same tradeoff as the booking-confirmation email: the profile's
    // approval state is unaffected either way, so log and move on rather
    // than failing whatever triggered this.
    console.error("Failed to send teacher review notification email:", err);
  }
}
