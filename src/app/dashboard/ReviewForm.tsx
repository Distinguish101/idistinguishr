"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, rating, comment: comment.trim() || undefined }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't submit your review.");
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="ghost-btn" onClick={() => setOpen(true)}>
        Leave a review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 10, minWidth: 220 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Rating</label>
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Comment (optional)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Spinner label="Submitting…" /> : "Submit review"}
        </button>
        <button type="button" className="ghost-btn" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
}
