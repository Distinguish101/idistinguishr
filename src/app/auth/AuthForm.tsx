"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

type Mode = "signup" | "login";

type BookingContext = {
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  duration: number;
  format: "ONLINE" | "IN_PERSON";
};

export function AuthForm({
  googleEnabled,
  bookingContext,
}: {
  googleEnabled: boolean;
  bookingContext: BookingContext | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A pending booking selection only becomes a real PENDING_PAYMENT hold
  // once we have a studentId to attach it to — that's now, right after
  // sign-in succeeds (see src/app/api/bookings/route.ts).
  async function afterSignIn() {
    const session = await getSession();
    const role = session?.user?.role;

    if (bookingContext && role === "STUDENT") {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: bookingContext.teacherId,
          date: bookingContext.date,
          startTime: bookingContext.startTime,
          durationMinutes: bookingContext.duration,
          format: bookingContext.format,
        }),
      });
      if (res.ok) {
        const { booking } = await res.json();
        router.push(`/checkout?bookingId=${booking.id}`);
        router.refresh();
        return;
      }
      // Slot's gone (taken meanwhile, or the hold window lapsed) — send
      // them back to pick a fresh one rather than dropping the intent.
      router.push(`/book/${bookingContext.teacherId}`);
      router.refresh();
      return;
    }

    router.push(role === "TEACHER" ? "/teacher/profile" : "/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password, role }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Couldn't create your account.");
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }
      await afterSignIn();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-toggle">
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "signup" && (
          <>
            <div className="field">
              <label>Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            {!bookingContext && (
              <div className="field">
                <label>I am a...</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "STUDENT" | "TEACHER")}>
                  <option value="STUDENT">Student, looking for lessons</option>
                  <option value="TEACHER">Teacher, offering lessons</option>
                </select>
              </div>
            )}
          </>
        )}

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? <Spinner label="Please wait…" /> : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div style={{ textAlign: "center", margin: "16px 0", color: "var(--text-soft)", fontSize: 13 }}>
            or
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={() => signIn("google", { callbackUrl: "/post-auth" })}
          >
            Continue with Google
          </button>
        </>
      )}
    </>
  );
}
