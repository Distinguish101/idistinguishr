import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { SignOutButton } from "./SignOutButton";

export async function NavBar() {
  const session = await auth();

  return (
    <nav className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/" className="logo">
          <Image src="/logo.png" alt="IDistinguishR" width={110} height={32} priority />
        </Link>
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
              <SignOutButton />
            </>
          ) : (
            <Link href="/auth">Log in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
