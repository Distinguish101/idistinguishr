import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-inner">
        <span className="t-soft">© {new Date().getFullYear()} IDistinguishR</span>
        <div className="site-footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@idistinguishr.example">Contact</a>
        </div>
      </div>
    </footer>
  );
}
