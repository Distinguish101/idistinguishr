import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms — IDistinguishR" };

// Draft boilerplate reflecting what the app actually does (48hr
// cancellation window, 10% platform fee, Stripe-handled payments) — not
// reviewed by a lawyer. Needs real business details (registered entity,
// address, jurisdiction beyond "UK-focused") before this is production-ready.
export default function TermsPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Terms of Service
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: October 2026</p>

      <div className="legal-content">
        <p>
          These terms cover your use of IDistinguishR, a marketplace connecting students with
          independent instrument instructors in the UK. By creating an account, you agree to them.
        </p>

        <h2>1. What we are</h2>
        <p>
          IDistinguishR is a booking and payments platform. Instructors listed on the site are
          independent contractors, not our employees — we don&apos;t control how they teach, and
          we&apos;re not a party to the lesson itself, only to the booking and payment.
        </p>

        <h2>2. Booking and payment</h2>
        <p>
          Payment is taken in full at the time of booking and held until the lesson takes place.
          A platform fee (currently 10%) is deducted from the amount paid to the instructor; students
          are charged the listed hourly rate with no additional fee added on top.
        </p>

        <h2>3. Cancellations</h2>
        <p>
          Students can cancel a booking free of charge up to 48 hours before the lesson start
          time. Cancellations inside that window are not eligible for a refund through the app.
          If something goes wrong, contact us and we&apos;ll look at it manually — refunds outside
          the standard window are handled case by case, not automatically.
        </p>

        <h2>4. Instructor approval</h2>
        <p>
          Instructor profiles are reviewed before they go live, using an automated first check and,
          where it&apos;s needed, a person. Approval isn&apos;t a guarantee of teaching quality — please
          use reviews and your own judgement.
        </p>

        <h2>5. Account conduct</h2>
        <p>
          Don&apos;t use the platform to arrange lessons off-platform to avoid fees, don&apos;t
          submit false information in a profile or review, and don&apos;t use another
          person&apos;s account.
        </p>

        <p>
          Instructors also agree to the <Link href="/instructor-agreement">Instructor Agreement</Link>.
        </p>

        <h2>6. Changes</h2>
        <p>
          We may update these terms as the product changes. Material changes will be reflected
          here with an updated date.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions about these terms? <Link href="/contact">Send us a message</Link>.
        </p>
      </div>
    </main>
  );
}
