import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility — IDistinguishR",
  description: "How accessible IDistinguishR is, what we know still needs work, and how to tell us about a problem.",
};

// Written from what has actually been built and tested (see
// docs/idistinguishr-build-log.md, sections 32 and 33). Keep it honest: update
// the "not yet done" list as items are completed, never the other way round.
export default function AccessibilityPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 720 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Accessibility statement
      </h1>
      <p className="t-soft" style={{ marginBottom: 32 }}>Last updated: October 2026</p>

      <div className="legal-content">
        <p>
          We want everyone to be able to find and book lessons on IDistinguishR, including people who use screen
          readers, keyboards, magnification or other assistive tools. Our target is the Web Content Accessibility
          Guidelines (WCAG) 2.2, level AA.
        </p>

        <h2>What we&apos;ve done</h2>
        <ul>
          <li>Every form field has a visible label that is properly linked to it.</li>
          <li>You can use the whole site with a keyboard, with a clearly visible focus outline, and a &ldquo;Skip to content&rdquo; link on every page.</li>
          <li>All text and interface colours were measured against WCAG AA contrast in each of the three themes (Cobalt, Slate and Midnight). The Theme menu in the header lets you pick the one you find easiest to read.</li>
          <li>Text is at least 16px, buttons and links have large touch targets, and pages reflow on small screens.</li>
          <li>If your device is set to reduce motion, the homepage carousel doesn&apos;t move on its own. It also pauses while you hover over it or focus it.</li>
          <li>Errors say what went wrong in words and with an icon, not by colour alone.</li>
          <li>We tested the public pages with an automated checker (axe-core) and found no issues at the time.</li>
        </ul>

        <h2>What we know isn&apos;t finished</h2>
        <ul>
          <li>We haven&apos;t yet done a full review with screen readers, or user testing with disabled people.</li>
          <li>The pages you see after logging in, including the booking calendar, are still being checked in each theme.</li>
          <li>Instructors add their own profile photos by web address, and these may not have descriptions.</li>
        </ul>

        <h2>Tell us about a problem</h2>
        <p>
          If something is hard to use, or you need information in a different format, please{" "}
          <Link href="/contact">contact us</Link> and choose &ldquo;Accessibility&rdquo;. Tell us the page, what you
          were trying to do, and the device or assistive tool you used if you can. We read every report and will fix
          what we can.
        </p>
      </div>
    </main>
  );
}
