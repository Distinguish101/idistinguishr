"use client";

import { useState, type FormEvent, useId } from "react";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { passwordIssue } from "@/lib/password";

export function ResetPasswordForm({ token }: { token: string }) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    const weakness = passwordIssue(password);
    if (weakness) {
      setError(weakness);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't reset your password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p>
        Your password has been changed. <Link href="/auth">Log in</Link> with the new one.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${uid}-1`}>New password</label>
        <input id={`${uid}-1`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="field-hint">At least 8 characters, with a letter and a number.</p>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-2`}>Confirm new password</label>
        <input id={`${uid}-2`}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p className="field-error">
          {error}{" "}
          {error.includes("Request a new one") && <Link href="/forgot-password">Request a new link</Link>}
        </p>
      )}
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? <Spinner label="Saving…" /> : "Change password"}
      </button>
    </form>
  );
}
