import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "IDistinguishR — Find your teacher",
  description: "Find and book instrument teachers, online or in person.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <NavBar />
          <div className="page-content">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
