import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Info, Todo } from "@/components/Todo";

export const metadata: Metadata = {
  title: "Safety and safeguarding — IDistinguishR",
  description: "How IDistinguishR approaches safety, and how to raise a concern.",
};

// DRAFT. The "what we do now" list states only things the product really does.
// Everything bracketed is a decision the owner still has to make; do not
// promise vetting (e.g. DBS checks) here until it is actually in place.
export default function SafeguardingPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Safety and safeguarding
      </h1>
      <p className="t-soft" style={{ marginBottom: 24 }}>Last updated: October 2026</p>
      <DraftNotice />

      <div className="legal-content">
        <p>
          Learning music should be enjoyable and safe for everyone. This page explains what we do, what we ask of
          instructors and students, and how to raise a concern.
        </p>

        <h2>If someone is in danger</h2>
        <p>
          If a child or adult is at immediate risk of harm, call <strong>999</strong>. For advice about a child, the
          NSPCC Helpline is <strong>0808 800 5000</strong>.
        </p>

        <h2>What we do now</h2>
        <ul>
          <li>Every instructor profile is checked before it goes live, using an automated first check and, where it&apos;s needed, a person.</li>
          <li>Only students who have had a lesson with an instructor can review them.</li>
          <li>Payments go through the platform (Stripe), and our terms don&apos;t allow arranging lessons off the platform to avoid fees.</li>
          <li>You can report a concern to us at any time, and we will look at it.</li>
        </ul>

        <h2>Lessons for children and young people</h2>
        <p>
          <Todo>
            To be confirmed: whether under-18s can take lessons on IDistinguishR, and if so whether a parent or
            guardian must book, and be present or nearby, during lessons
          </Todo>
        </p>

        <h2>Checks on instructors</h2>
        <p>
          <Todo>
            To be confirmed: what checks instructors must complete, for example whether an enhanced DBS check is
            required for anyone teaching under-18s, and how often it is renewed
          </Todo>
        </p>

        <h2>Tips for safe lessons</h2>
        <ul>
          <li>Keep bookings, payments and messages on IDistinguishR.</li>
          <li>For online lessons, use a shared space such as a living room, and keep a parent or guardian nearby for younger learners.</li>
          <li>If something doesn&apos;t feel right, stop the lesson and tell us.</li>
        </ul>

        <h2>Raising a concern</h2>
        <p>
          <Link href="/contact">Contact us</Link> and choose &ldquo;Safety or safeguarding concern&rdquo;. Please include
          who and what is involved and when it happened. Concerns are handled by <Info field="safeguardingLead" label="safeguarding lead, name or role" />.
        </p>
      </div>
    </main>
  );
}
