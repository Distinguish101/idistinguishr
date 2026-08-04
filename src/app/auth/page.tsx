// SCREEN 5 — Sign Up / Login
// Covers: US-12 (signup after time selection), US-13 (login), US-14 (OAuth)
// Reference mockup: mockups.html → #auth
// Reference spec: booking-flow-spec.md → "5. Sign Up / Login"
//
// The booking-context banner (persisting a pending teacher/time selection
// through signup) belongs to the student booking flow — not built yet
// (that's step 4 in the README's build order). This covers plain
// signup/login + role-based routing, which teacher-side pages need now.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "./AuthForm";

export default async function AuthPage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "TEACHER" ? "/teacher/profile" : "/dashboard");
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Sign up or log in</span>
        <h1 className="t-display-l" style={{ marginBottom: 20 }}>
          IDistinguishR
        </h1>
        <AuthForm googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
