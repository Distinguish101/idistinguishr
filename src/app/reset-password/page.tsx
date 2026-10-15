import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password — IDistinguishR" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Reset your password</span>
        <h1 className="t-display-l" style={{ marginBottom: 20 }}>
          Choose a new password
        </h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p>
            This reset link is incomplete. <Link href="/forgot-password">Request a new one</Link>.
          </p>
        )}
      </div>
    </main>
  );
}
