import Link from "next/link";

// Shown for any address that doesn't exist, in place of Next.js's plain default.
export default function NotFound() {
  return (
    <main className="confirm-shell">
      <h1 className="t-display-l">Page not found</h1>
      <p className="t-soft" style={{ marginTop: 12 }}>
        That page doesn&apos;t exist, or it has moved.
      </p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
        Back to the homepage
      </Link>
    </main>
  );
}
