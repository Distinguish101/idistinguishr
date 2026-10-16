"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A header link that marks itself as the current page (aria-current="page"),
// which both screen readers announce and the stylesheet highlights.
export function NavLink({
  href,
  exact = false,
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
