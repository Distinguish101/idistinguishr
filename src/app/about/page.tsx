import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About us — IDistinguishR",
  description: "IDistinguishR helps people in the UK find and book private instrument lessons.",
};

export default function AboutPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 16 }}>
        About IDistinguishR
      </h1>

      <div className="legal-content">
        <p style={{ fontSize: "1.1875rem" }}>
          IDistinguishR helps people in the UK find and book private instrument lessons with independent
          instructors, online or in person.
        </p>

        <h2>What we do</h2>
        <p>
          Search by instrument, price, format and availability, look at an instructor&apos;s real calendar, and book
          and pay in one go. Lessons can be cancelled for free up to 48 hours before they start.
        </p>

        <h2>How instructors join</h2>
        <p>
          Instructors create a profile, set their availability and rate, and connect payouts through Stripe. Every
          profile is checked before it goes live. Instructors are independent, so they set their own prices and
          teach in their own way.
        </p>

        <h2>What we care about</h2>
        <ul>
          <li>
            <strong>Fair pricing.</strong> Students pay the hourly rate on the instructor&apos;s profile with no booking
            fee added on top. We take a platform fee (currently 10%) from the instructor&apos;s side.
          </li>
          <li>
            <strong>Honest reviews.</strong> Only students who have had a lesson with an instructor can review them.
          </li>
          <li>
            <strong>Safe payments.</strong> Card details go straight to Stripe. We never see or store them.
          </li>
          <li>
            <strong>Everyone can use it.</strong> We&apos;re working towards WCAG 2.2 AA; see our{" "}
            <Link href="/accessibility">accessibility statement</Link>.
          </li>
        </ul>

        <h2>Get in touch</h2>
        <p>
          Have a question or an idea? <Link href="/contact">Send us a message</Link> or read the{" "}
          <Link href="/faq">Help centre</Link>.
        </p>
      </div>
    </main>
  );
}
