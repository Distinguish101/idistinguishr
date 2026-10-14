"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="linklike"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        signOut({ callbackUrl: "/" });
      }}
    >
      {loading ? <Spinner label="Signing out…" /> : "Sign out"}
    </button>
  );
}
