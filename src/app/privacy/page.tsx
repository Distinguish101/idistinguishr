import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy — IDistinguishR" };

// Same status as /terms — draft boilerplate grounded in what's actually
// collected/stored in the schema, not a lawyer-reviewed policy.
export default function PrivacyPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <span className="eyebrow">Legal</span>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Privacy Policy
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: August 2026</p>

      <div className="legal-content">
        <p>
          This explains what information IDistinguishR collects and what we do with it.
        </p>

        <h3>1. What we collect</h3>
        <p>
          Account details you provide directly: name, email, and password (stored as a salted
          hash, never in plain text). Teachers additionally provide a bio, instruments, rate,
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
          A teacher&apos;s public profile (bio, instruments, rate, reviews) is visible to anyone
          browsing the site once approved. A student&apos;s name is visible to a teacher they&apos;ve
          booked a lesson with, and vice versa — this is necessary to actually run the lesson.
        </p>

        <h3>5. How long we keep it</h3>
        <p>
          We keep account and booking data for as long as your account is active. If you want
          your account deleted, contact us and we&apos;ll action it, subject to what we&apos;re
          legally required to retain (e.g. payment records).
        </p>

        <h3>6. Contact</h3>
        <p>
          Questions about this policy, or to request your data be deleted:{" "}
          <a href="mailto:hello@idistinguishr.example">hello@idistinguishr.example</a>.
        </p>
      </div>
    </main>
  );
}
