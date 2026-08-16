"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

export function ApprovalButtons({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approvalStatus: "APPROVED" | "REJECTED") {
    setLoading(approvalStatus);
    setError(null);
    const res = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    });
    setLoading(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't update this teacher.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => decide("APPROVED")}
          disabled={loading !== null}
        >
          {loading === "APPROVED" ? <Spinner label="Approving…" /> : "Approve"}
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => decide("REJECTED")}
          disabled={loading !== null}
        >
          {loading === "REJECTED" ? <Spinner label="Rejecting…" /> : "Reject"}
        </button>
      </div>
      {error && (
        <p className="field-error" style={{ marginTop: 6, fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
