import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy — IDistinguishR",
  description: "The few cookies IDistinguishR uses, and why.",
};

// Grounded in what the app actually sets (Auth.js sign-in cookies and the
// theme cookie) and what it doesn't use (no analytics, advertising or social
// trackers). Re-check this page whenever a tracking or analytics tool is added.
// Draft wording, not reviewed by a lawyer.
export default function CookiePolicyPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Cookie Policy
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: October 2026</p>

      <div className="legal-content">
        <p>
          Cookies are small files a website stores in your browser. IDistinguishR uses only the few it needs to work.
          We don&apos;t use analytics, advertising or social-media tracking cookies.
        </p>

        <h2>Cookies we set</h2>
        <ul>
          <li>
            <strong>Signing in.</strong> A session cookie keeps you logged in, and short-lived security cookies are
            used while you sign in to protect against forged requests. The session lasts until you sign out or it
            expires.
          </li>
          <li>
            <strong>Your theme.</strong> A cookie called <code>theme</code> remembers whether you chose Cobalt, Slate
            or Midnight, so the next page loads in the right look. It lasts a year.
          </li>
        </ul>

        <h2>Other companies&apos; cookies</h2>
        <p>
          When you pay, you are on Stripe&apos;s secure page, and Stripe sets its own cookies there. See Stripe&apos;s
          own policy for details. Instructor photos are loaded from the web address each instructor provided, so the
          site hosting a photo can see your IP address, as with any image on the web.
        </p>

        <h2>Controlling cookies</h2>
        <p>
          You can block or delete cookies in your browser settings. Blocking the sign-in cookies means you won&apos;t be
          able to log in, and blocking the theme cookie means the site returns to the default look on each visit.
        </p>

        <h2>Questions</h2>
        <p>
          <Link href="/contact">Contact us</Link>. For how we handle your data more generally, see our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
