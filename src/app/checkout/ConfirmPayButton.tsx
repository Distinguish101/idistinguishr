"use client";

import { useState } from "react";

export function ConfirmPayButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't start checkout — try again.");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <>
      {error && (
        <p className="field-error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting to payment…" : "Confirm & Pay"}
      </button>
    </>
  );
}
