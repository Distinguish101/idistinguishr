import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared onboarding@resend.dev sender works without verifying a
// domain, but in that mode only delivers to the Resend account's own
// email — fine for confirming the integration works, not for real
// students. Swap in a verified domain's address when that's set up.
const FROM = "IDistinguishR <onboarding@resend.dev>";

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
