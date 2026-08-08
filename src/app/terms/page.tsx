import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms — IDistinguishR" };

// Draft boilerplate reflecting what the app actually does (48hr
// cancellation window, 10% platform fee, Stripe-handled payments) — not
// reviewed by a lawyer. Needs real business details (registered entity,
// address, jurisdiction beyond "UK-focused") before this is production-ready.
export default function TermsPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <span className="eyebrow">Legal</span>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Terms of Service
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: August 2026</p>

      <div className="legal-content">
        <p>
          These terms cover your use of IDistinguishR, a marketplace connecting students with
          independent instrument teachers in the UK. By creating an account, you agree to them.
        </p>

        <h3>1. What we are</h3>
        <p>
          IDistinguishR is a booking and payments platform. Teachers listed on the site are
          independent contractors, not our employees — we don&apos;t control how they teach, and
          we&apos;re not a party to the lesson itself, only to the booking and payment.
        </p>

        <h3>2. Booking and payment</h3>
        <p>
          Payment is taken in full at the time of booking and held until the lesson takes place.
          A platform fee (currently 10%) is deducted from the amount paid to the teacher; students
          are charged the listed hourly rate with no additional fee added on top.
        </p>

        <h3>3. Cancellations</h3>
        <p>
          Students can cancel a booking free of charge up to 48 hours before the lesson start
          time. Cancellations inside that window are not eligible for a refund through the app.
          If something goes wrong, contact us and we&apos;ll look at it manually — refunds outside
          the standard window are handled case by case, not automatically.
        </p>

        <h3>4. Teacher approval</h3>
        <p>
          Teachers are manually reviewed before their profile goes live. Approval isn&apos;t a
          guarantee of teaching quality — please use reviews and your own judgement.
        </p>

        <h3>5. Account conduct</h3>
        <p>
          Don&apos;t use the platform to arrange lessons off-platform to avoid fees, don&apos;t
          submit false information in a profile or review, and don&apos;t use another
          person&apos;s account.
        </p>

        <h3>6. Changes</h3>
        <p>
          We may update these terms as the product changes. Material changes will be reflected
          here with an updated date.
        </p>

        <h3>7. Contact</h3>
        <p>
          Questions about these terms: <a href="mailto:hello@idistinguishr.example">hello@idistinguishr.example</a>.
        </p>
      </div>
    </main>
  );
}
