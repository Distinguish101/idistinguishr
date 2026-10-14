"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    // redirect: false so the redirect isn't built server-side (behind the
    // proxy that used to resolve to the pod's internal address); navigate here.
    await signOut({ redirect: false });
    window.location.assign("/");
  }

  return (
    <button type="button" className="linklike" disabled={loading} onClick={handleSignOut}>
      {loading ? <Spinner label="Signing out…" /> : "Sign out"}
    </button>
  );
}
