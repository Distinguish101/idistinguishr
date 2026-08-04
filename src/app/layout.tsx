import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
