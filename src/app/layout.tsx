import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Figtree, Hanken_Grotesk, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "IDistinguishR — Find your instructor",
  description: "Find and book instrument instructors, online or in person.",
};

// next/font self-hosts these at build time (no request to Google from a
// visitor's browser). All are variable fonts. Only the default theme's font is
// preloaded; the others are only fetched when a theme that uses them is
// actually applied.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--f-hanken", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-bricolage", display: "swap", preload: false });
const figtree = Figtree({ subsets: ["latin"], variable: "--f-figtree", display: "swap", preload: false });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--f-schibsted", display: "swap", preload: false });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en-GB"
      data-theme={theme}
      className={`${hanken.variable} ${bricolage.variable} ${figtree.variable} ${schibsted.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="page-shell">
          <NavBar theme={theme} />
          <div className="page-content" id="main" tabIndex={-1}>
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
