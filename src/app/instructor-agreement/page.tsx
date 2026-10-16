import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Info, Todo } from "@/components/Todo";

export const metadata: Metadata = {
  title: "Instructor Agreement — IDistinguishR",
  description: "The terms for teaching on IDistinguishR.",
};

// DRAFT. Clauses 3, 4, 6 and 7 restate what the product and the Terms of
// Service already do (10% fee, Stripe payouts, 48-hour free cancellation, no
// off-platform arrangements, self-service deactivate/delete). Bracketed items
// are decisions the owner still has to make. Not reviewed by a solicitor.
export default function InstructorAgreementPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Instructor Agreement
      </h1>
      <p className="t-soft" style={{ marginBottom: 24 }}>Last updated: October 2026</p>
      <DraftNotice />

      <div className="legal-content">
        <p>
          This agreement sits alongside our <Link href="/terms">Terms of Service</Link> and applies to anyone who
          offers lessons on IDistinguishR. By creating an instructor profile, you agree to it.
        </p>

        <h2>1. Who this is between</h2>
        <p>
          This agreement is between you and <Info field="legalName" label="legal name of the company or trader" />,
          trading as IDistinguishR (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>

        <h2>2. You are independent</h2>
        <p>
          You are an independent instructor, not our employee, worker or partner. You decide how you teach, what you
          charge and when you are available. We provide the platform for finding students, booking and payment.
        </p>

        <h2>3. Fees and payouts</h2>
        <p>
          Students pay your listed hourly rate at the time of booking. We deduct a platform fee, currently 10%, from the
          amount paid to you. Payouts are handled by Stripe: you must complete Stripe&apos;s onboarding, you agree to
          Stripe&apos;s own terms, and payouts follow Stripe&apos;s schedule. You are responsible for your own tax
          affairs.
        </p>

        <h2>4. Bookings and cancellations</h2>
        <p>
          You agree to teach the lessons students book with you, at the times shown on your calendar. Students can
          cancel for free up to 48 hours before a lesson. Keep your availability up to date so students can rely on it.
        </p>
        <p>
          <Todo>To be confirmed: what happens if you need to cancel a lesson, and any consequences for repeated cancellations</Todo>
        </p>

        <h2>5. Your profile</h2>
        <p>
          Everything in your profile, including your bio, credentials, location and photo, must be true and, for the
          photo, yours to use. Profiles are reviewed before they go live. We may ask you to change a profile, or remove
          it, if it breaks this agreement or our terms.
        </p>

        <h2>6. Conduct</h2>
        <ul>
          <li>Do not arrange lessons or payments off the platform to avoid fees.</li>
          <li>Treat students and their families with respect, and follow our <Link href="/safeguarding">safety and safeguarding</Link> guidance.</li>
          <li>Do not post false reviews or ask students to post reviews that aren&apos;t honest.</li>
          <li>Do not use another person&apos;s account.</li>
        </ul>

        <h2>7. Ending this agreement</h2>
        <p>
          You can deactivate or delete your account at any time from the <Link href="/account">Account</Link> page,
          once you have no upcoming lessons. We may suspend or remove an account that breaks this agreement or our
          terms, or that puts others at risk.
        </p>

        <h2>8. Responsibility</h2>
        <p>
          <Todo>
            To be reviewed by a solicitor: limits on our liability, and what you are responsible for in the lessons you
            give, including any insurance you should hold
          </Todo>
        </p>

        <h2>9. Governing law</h2>
        <p>
          This agreement is governed by the law of <Info field="governingLaw" label="governing law, e.g. England and Wales" />.
        </p>

        <h2>10. Changes and contact</h2>
        <p>
          We may update this agreement as the product changes, and will show the new date here. Questions?{" "}
          <Link href="/contact">Send us a message</Link>.
        </p>
      </div>
    </main>
  );
}
