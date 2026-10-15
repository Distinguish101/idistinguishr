import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password — IDistinguishR" };

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Reset your password</span>
        <h1 className="t-display-l" style={{ marginBottom: 20 }}>
          Forgot password?
        </h1>
        <ForgotPasswordForm />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
          <Link href="/auth">Back to log in</Link>
        </p>
      </div>
    </main>
  );
}
