import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import type { ThemeId } from "@/lib/theme";
import { SignOutButton } from "./SignOutButton";
import { ThemeSwitcher } from "./ThemeSwitcher";

// A text wordmark with a drawn note (not the old PNG): it takes its colour
// from the theme, so it stays legible on every header colour.
function Wordmark() {
  return (
    <Link href="/" className="logo" aria-label="IDistinguishR, home">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </svg>
      <span>IDistinguishR</span>
    </Link>
  );
}

export async function NavBar({ theme }: { theme: ThemeId }) {
  const session = await auth();

  return (
    <nav className="topbar" aria-label="Main">
      <div className="wrap topbar-inner">
        <Wordmark />
        <div className="topbar-links">
          {session?.user ? (
            <>
              {session.user.role === "TEACHER" ? (
                <>
                  <Link href="/teacher/dashboard">Dashboard</Link>
                  <Link href="/teacher/profile">Profile</Link>
                  <Link href="/teacher/availability">Availability</Link>
                </>
              ) : (
                <Link href="/dashboard">Dashboard</Link>
              )}
              {isAdminEmail(session.user.email) && <Link href="/admin">Admin</Link>}
              <Link href="/account">Account</Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/auth" className="nav-cta">
              Log in
            </Link>
          )}
          <ThemeSwitcher current={theme} />
        </div>
      </div>
    </nav>
  );
}
