"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Shown while the booking is still waiting for Stripe's webhook to confirm the
// payment (usually a few seconds). Re-fetches the page every 2 seconds, and
// gives up after 30 so a stuck booking doesn't poll forever; the page tells
// the student to refresh by hand after that.
export function AutoRefresh({ everyMs = 2000, maxMs = 30_000 }: { everyMs?: number; maxMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started >= maxMs) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxMs]);

  return null;
}
