"use client";

import Link from "next/link";

// Shown when something unexpected fails while a page is being built. The
// details stay in the server logs and traces; the visitor only sees this.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="confirm-shell">
      <h1 className="t-display-l">Something went wrong</h1>
      <p className="t-soft" style={{ marginTop: 12 }}>
        We couldn&apos;t load this page just now. Please try again in a moment.
      </p>
      <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => reset()}>
        Try again
      </button>{" "}
      <Link href="/" className="btn" style={{ marginTop: 20, display: "inline-block" }}>
        Back to the homepage
      </Link>
    </main>
  );
}
