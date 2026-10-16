import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact us — IDistinguishR",
  description: "Get in touch with the IDistinguishR team.",
};

export default function ContactPage() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 640 }}>
      <h1 className="t-display-l" style={{ marginBottom: 8 }}>
        Contact us
      </h1>
      <p className="t-soft" style={{ marginBottom: 24 }}>
        Questions, feedback or a problem with a booking? Send us a message and we&apos;ll reply by email. Many
        answers are also in the <Link href="/faq">Help centre</Link>.
      </p>
      <ContactForm />
    </main>
  );
}
