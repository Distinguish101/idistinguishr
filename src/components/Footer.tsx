import Link from "next/link";
import { SITE_INFO } from "@/lib/site-info";
import { Info } from "@/components/Todo";

// "IDistinguishR is a trading name of ..." with highlighted placeholders until
// the details are filled in (src/lib/site-info.ts).
function CompanyLine() {
  const soleTrader = SITE_INFO.entityType === "sole trader";
  return (
    <p className="footer-company">
      IDistinguishR is a trading name of <Info field="legalName" label="registered company name" />.{" "}
      {!soleTrader && (
        <>
          Company number <Info field="companyNumber" label="company number" />.{" "}
        </>
      )}
      Address: <Info field="registeredAddress" label="registered address" />.
    </p>
  );
}

// Browse links are static on purpose: the footer is on every page, and a
// database query here would make every page depend on it.
const INSTRUMENTS = ["Guitar", "Piano", "Violin", "Drums", "Voice"];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      {/* Decorative oversized wordmark; textLength makes it span the full width. */}
      <svg className="footer-mark" viewBox="0 0 1000 150" aria-hidden="true" focusable="false">
        <text x="0" y="112" textLength="1000" lengthAdjust="spacingAndGlyphs">
          IDistinguishR
        </text>
      </svg>

      <div className="wrap footer-main">
        <p className="footer-tagline">Private instrument lessons, online or in person.</p>

        <nav className="footer-cols" aria-label="Footer">
          <div>
            <h2>IDistinguishR</h2>
            <ul>
              <li>
                <Link href="/about">About us</Link>
              </li>
              <li>
                <Link href="/#how-title">How it works</Link>
              </li>
              <li>
                <Link href="/contact">Contact us</Link>
              </li>
              <li>
                <Link href="/faq">Help centre</Link>
              </li>
              <li>
                <Link href="/safeguarding">Safety and safeguarding</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Students</h2>
            <ul>
              <li>
                <Link href="/results">Find an instructor</Link>
              </li>
              <li>
                <Link href="/faq#booking">Booking and payment</Link>
              </li>
              <li>
                <Link href="/faq#cancelling">Cancellations</Link>
              </li>
              <li>
                <Link href="/auth">Log in or sign up</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Instructors</h2>
            <ul>
              <li>
                <Link href="/auth">Become an instructor</Link>
              </li>
              <li>
                <Link href="/faq#payouts">How you get paid</Link>
              </li>
              <li>
                <Link href="/faq#instructors">Instructor questions</Link>
              </li>
              <li>
                <Link href="/instructor-agreement">Instructor agreement</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Instruments</h2>
            <ul>
              {INSTRUMENTS.map((i) => (
                <li key={i}>
                  <Link href={`/results?instrument=${i.toLowerCase()}`}>{i} lessons</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className="wrap footer-company-row">
        <CompanyLine />
      </div>

      <div className="wrap footer-legal">
        <p className="footer-copy">© {year} IDistinguishR</p>
        <ul>
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
          <li>
            <Link href="/instructor-agreement">Instructor Agreement</Link>
          </li>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/cookies">Cookie Policy</Link>
          </li>
          <li>
            <Link href="/accessibility">Accessibility</Link>
          </li>
        </ul>
        <p className="footer-stripe">Payments processed securely by Stripe</p>
      </div>
    </footer>
  );
}
