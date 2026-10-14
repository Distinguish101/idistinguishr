"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";

// A plain link to /api/stripe/connect, which creates the Stripe account and
// redirects to Stripe's hosted onboarding. That server round trip takes a
// couple of seconds, so show progress instead of a dead-looking button.
export function StripeConnectLink({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <a
      href="/api/stripe/connect"
      className="btn btn-primary"
      aria-busy={loading}
      onClick={() => setLoading(true)}
      style={loading ? { pointerEvents: "none", opacity: 0.85 } : undefined}
    >
      {loading ? <Spinner label="Opening Stripe…" /> : label}
    </a>
  );
}
