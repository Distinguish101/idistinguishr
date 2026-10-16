import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help centre — IDistinguishR",
  description: "Answers about booking, paying, cancelling and teaching on IDistinguishR.",
};

type QA = { q: string; a: React.ReactNode };

const SECTIONS: { id: string; title: string; items: QA[] }[] = [
  {
    id: "booking",
    title: "Booking and payment",
    items: [
      {
        q: "How do I book a lesson?",
        a: (
          <>
            <Link href="/results">Find an instructor</Link>, open their profile, pick a date and time on their
            calendar, choose the lesson length and format, then sign up or log in and pay. You&apos;ll get a
            confirmation email.
          </>
        ),
      },
      {
        q: "How do I pay?",
        a: "You pay by card at the time of booking, through Stripe. Your card details go directly to Stripe, and we never see or store them. You pay the hourly rate shown on the instructor's profile, with no booking fee added.",
      },
      {
        q: "Can I take lessons online or in person?",
        a: "That depends on the instructor. Each profile shows whether they teach online, in person or both, and where.",
      },
    ],
  },
  {
    id: "cancelling",
    title: "Cancelling",
    items: [
      {
        q: "Can I cancel a lesson?",
        a: "Yes. You can cancel for free up to 48 hours before the lesson starts, from your dashboard.",
      },
      {
        q: "What if I need to cancel closer to the lesson?",
        a: (
          <>
            Cancellations inside 48 hours can&apos;t be refunded through the app. If something went wrong,{" "}
            <Link href="/contact">contact us</Link> and we&apos;ll look at it individually.
          </>
        ),
      },
    ],
  },
  {
    id: "instructors",
    title: "For instructors",
    items: [
      {
        q: "How do I become an instructor?",
        a: (
          <>
            <Link href="/auth">Sign up</Link> and choose &ldquo;Instructor&rdquo;. Fill in your profile (bio,
            instruments, rate, formats and location), set your availability and connect payouts with Stripe. Your
            profile is checked before it goes live.
          </>
        ),
      },
      {
        q: "Do I set my own prices and hours?",
        a: "Yes. You choose your hourly rate, the formats you offer and the times you're available.",
      },
    ],
  },
  {
    id: "payouts",
    title: "How instructors get paid",
    items: [
      {
        q: "How do payouts work?",
        a: "Payments are handled by Stripe. You connect a bank account through Stripe when you set up your profile, and payouts follow Stripe's payout schedule.",
      },
      {
        q: "What does IDistinguishR charge?",
        a: "A platform fee, currently 10%, is deducted from the amount paid to you. Students pay your listed rate with nothing added on top.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    items: [
      {
        q: "How do I report a concern?",
        a: (
          <>
            <Link href="/contact">Contact us</Link> and choose &ldquo;Safety or safeguarding concern&rdquo;. Our{" "}
            <Link href="/safeguarding">safety and safeguarding</Link> page explains what we do. If someone is in
            immediate danger, call 999.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    items: [
      {
        q: "I forgot my password.",
        a: (
          <>
            Use <Link href="/forgot-password">Forgot password</Link> and we&apos;ll email you a link to choose a new
            one. The link works once and expires after an hour.
          </>
        ),
      },
      {
        q: "How do I deactivate or delete my account?",
        a: (
          <>
            Open <Link href="/account">Account</Link> once you&apos;re logged in. Deactivating switches your account
            off, and logging in again turns it back on. Deleting is permanent: your name, email and password are
            removed, and past bookings and payments are kept for record-keeping without your name. Both are
            unavailable while you have upcoming lessons.
          </>
        ),
      },
      {
        q: "What is the Theme menu?",
        a: "It changes how the site looks (Cobalt, Slate or Midnight). Your choice is remembered on this device.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 760 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Help centre
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>
        Can&apos;t find what you need? <Link href="/contact">Contact us</Link>.
      </p>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
          <h2 id={`${s.id}-title`} className="t-display-m" style={{ marginBottom: 12 }}>
            {s.title}
          </h2>
          {s.items.map((it) => (
            <details key={it.q} className="faq-item">
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </section>
      ))}
    </main>
  );
}
