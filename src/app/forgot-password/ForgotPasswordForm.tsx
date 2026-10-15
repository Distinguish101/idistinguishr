"use client";

import { useState, type FormEvent, useId } from "react";
import { Spinner } from "@/components/Spinner";

export function ForgotPasswordForm() {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p>
        If an account exists for <strong>{email}</strong>, we&rsquo;ve emailed a link to reset the
        password. It works once and expires in 1 hour. Check your spam folder if it doesn&rsquo;t
        arrive.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ marginTop: 0 }}>Enter your email and we&rsquo;ll send you a link to choose a new password.</p>
      <div className="field">
        <label htmlFor={`${uid}-1`}>Email</label>
        <input id={`${uid}-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? <Spinner label="Sending…" /> : "Send reset link"}
      </button>
    </form>
  );
}
