import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — IDistinguishR" };

// Same status as /terms — draft boilerplate grounded in what's actually
// collected/stored in the schema, not a lawyer-reviewed policy.
export default function PrivacyPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Privacy Policy
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: October 2026</p>

      <div className="legal-content">
        <p>
          This explains what information IDistinguishR collects and what we do with it.
        </p>

        <h3>1. What we collect</h3>
        <p>
          Account details you provide directly: name, email, and password (stored as a salted
          hash, never in plain text). Instructors additionally provide a bio, instruments, rate,
          location, and credentials for their public profile. Booking history — lesson dates,
          formats, and prices — is tied to your account.
        </p>

        <h3>2. Payments</h3>
        <p>
          We don&apos;t see or store your card details. Payments are processed by Stripe, and
          card information goes directly to them, not through our servers.
        </p>

        <h3>3. What we don&apos;t do</h3>
        <p>
          We don&apos;t sell your data to third parties. We don&apos;t use your booking history
          for advertising.
        </p>

        <h3>4. Who can see what</h3>
        <p>
          An instructor&apos;s public profile (bio, instruments, rate, reviews) is visible to anyone
          browsing the site once approved. A student&apos;s name is visible to an instructor they&apos;ve
          booked a lesson with, and vice versa — this is necessary to actually run the lesson.
        </p>

        <h3>5. How long we keep it, and deleting your account</h3>
        <p>
          We keep account and booking data for as long as your account is active. You can deactivate or
          permanently delete your account yourself from the <Link href="/account">Account</Link> page.
          Deleting removes your name, email and password (and an instructor&apos;s profile details) from
          our records. Booking, payment and review records are kept without your name, because the other
          person in a booking and our financial records still need them.
        </p>

        <h3>6. Cookies</h3>
        <p>
          We only use the cookies needed to keep you signed in and to remember your theme. See our{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </p>

        <h3>7. Contact</h3>
        <p>
          Questions about this policy, or a data request: <Link href="/contact">send us a message</Link>.
        </p>
      </div>
    </main>
  );
}
