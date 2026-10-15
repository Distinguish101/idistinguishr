"use client";

import { useState, type FormEvent, useId } from "react";
import { signOut } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

type Props = { hasPassword: boolean; isInstructor: boolean; upcomingLessons: number };

export function AccountActions({ hasPassword, isInstructor, upcomingLessons }: Props) {
  const uid = useId();
  const [busy, setBusy] = useState<"deactivate" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const blocked = upcomingLessons > 0;

  async function leave() {
    // redirect: false, then navigate ourselves (see SignOutButton for why).
    await signOut({ redirect: false });
    window.location.assign("/");
  }

  async function post(kind: "deactivate" | "delete", body?: object) {
    setError(null);
    setBusy(kind);
    try {
      const res = await fetch(`/api/account/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setBusy(null);
        return;
      }
      await leave();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  function handleDelete(e: FormEvent) {
    e.preventDefault();
    post("delete", hasPassword ? { password: secret } : { confirmText: secret });
  }

  return (
    <div style={{ marginTop: 32, display: "grid", gap: 24 }}>
      {blocked && (
        <p className="field-error" style={{ margin: 0 }}>
          You have {upcomingLessons} upcoming {upcomingLessons === 1 ? "lesson" : "lessons"}. Cancel{" "}
          {upcomingLessons === 1 ? "it" : "them"} or wait until {upcomingLessons === 1 ? "it's" : "they're"} done
          before deactivating or deleting your account.
        </p>
      )}

      <section style={{ border: "1px solid var(--line)", padding: 20 }}>
        <h2 className="t-display-m" style={{ marginTop: 0 }}>
          Deactivate account
        </h2>
        <p>
          Switches your account off for now.{" "}
          {isInstructor && "Your profile disappears from search and nobody can book you. "}
          Nothing is deleted, and logging in again with your password turns it back on.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={blocked || busy !== null}
          onClick={() => post("deactivate")}
        >
          {busy === "deactivate" ? <Spinner label="Deactivating…" /> : "Deactivate my account"}
        </button>
      </section>

      <section style={{ border: "1px solid var(--rust)", padding: 20 }}>
        <h2 className="t-display-m" style={{ marginTop: 0 }}>
          Delete account
        </h2>
        <p>
          Permanently removes your name, email and password{isInstructor ? " and your profile details" : ""}. This
          can&rsquo;t be undone. Past bookings and payments are kept for record-keeping, but no longer show your
          name.
        </p>
        {!confirmingDelete ? (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ borderColor: "var(--rust)", color: "var(--rust)" }}
            disabled={blocked || busy !== null}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete my account…
          </button>
        ) : (
          <form onSubmit={handleDelete}>
            <div className="field">
              <label htmlFor={`${uid}-1`}>{hasPassword ? "Enter your password to confirm" : "Type DELETE to confirm"}</label>
              <input id={`${uid}-1`}
                type={hasPassword ? "password" : "text"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                autoComplete={hasPassword ? "current-password" : "off"}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: "var(--rust)" }}
                disabled={busy !== null}
              >
                {busy === "delete" ? <Spinner label="Deleting…" /> : "Permanently delete"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => {
                  setConfirmingDelete(false);
                  setSecret("");
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
