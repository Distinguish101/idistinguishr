"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't cancel this booking.");
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="ghost-btn" onClick={handleCancel} disabled={loading}>
          {loading ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" className="ghost-btn" onClick={() => setConfirming(false)} disabled={loading}>
          Never mind
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="ghost-btn" onClick={() => setConfirming(true)}>
        Cancel
      </button>
      {error && (
        <p className="field-error" style={{ marginTop: 6, fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
