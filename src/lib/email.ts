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

// Sent when the Stripe webhook route rejects a delivery for a reason that
// means our end is misconfigured, not that the request itself was junk —
// a missing secret env var, or a signature that didn't verify. This is
// exactly the failure mode that let a stale STRIPE_THIN_WEBHOOK_SECRET go
// unnoticed for over a week (see build log §24): every real Stripe
// delivery 400'd, and nothing surfaced that anywhere. Deliberately NOT
// sent for a missing stripe-signature header or unparseable JSON — this
// endpoint is a public URL, so that's ordinary internet background noise
// (scanners, stray bots), not a signal anything's actually broken.
export async function sendWebhookVerificationFailedAlert(params: {
  path: "classic" | "thin" | "config";
  reason: string;
}) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  console.error(`Stripe webhook verification failed (${params.path}):`, params.reason);

  if (!resend || adminEmails.length === 0) {
    console.warn("RESEND_API_KEY or ADMIN_EMAILS not set — skipping webhook failure alert");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: adminEmails,
      subject: "Stripe webhook is failing to verify",
      html: `
        <p>A Stripe webhook delivery to <code>/api/webhooks/stripe</code> (${params.path} path)
        was rejected: <em>${params.reason}</em></p>
        <p>This usually means <code>STRIPE_WEBHOOK_SECRET</code> or
        <code>STRIPE_THIN_WEBHOOK_SECRET</code> in Vercel's env vars no longer matches the
        signing secret on the actual Stripe endpoint/event destination — booking confirmations,
        Stripe Connect status syncing, and automated teacher vetting all silently stop working
        when this happens. Check <a href="https://dashboard.stripe.com/webhooks">Stripe's
        webhooks dashboard</a> for delivery failures, and compare against what's in
        <a href="https://vercel.com/idistinguish/idistinguishr/settings/environment-variables">Vercel's
        project env vars</a>.</p>
        <p>Repeat deliveries of the same failed event will trigger this email again — Stripe
        retries a failed webhook several times, so don't be alarmed by more than one.</p>
      `,
    });
  } catch (err) {
    // If Resend itself is down there's nothing more to do here — the
    // console.error above is the fallback signal.
    console.error("Failed to send webhook failure alert email:", err);
  }
}
