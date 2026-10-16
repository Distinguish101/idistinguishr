"use client";

import { useId, useState, type FormEvent } from "react";
import { Spinner } from "@/components/Spinner";
import { CONTACT_TOPICS } from "@/lib/contact";

export function ContactForm() {
  const uid = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, never shown to people
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card" role="status">
        <h2 className="t-display-m" style={{ marginBottom: 8 }}>
          Message sent
        </h2>
        <p style={{ margin: 0 }}>
          Thanks, {name.split(" ")[0] || "we"}&apos;ve got it. We&apos;ll reply to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate={false}>
      <div className="field">
        <label htmlFor={`${uid}-name`}>Your name</label>
        <input
          id={`${uid}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-email`}>Email address</label>
        <input
          id={`${uid}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-topic`}>What is it about?</label>
        <select id={`${uid}-topic`} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-message`}>Message</label>
        <textarea
          id={`${uid}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={4000}
          rows={6}
        />
      </div>

      {/* Honeypot: invisible and unreachable for people, tempting for bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", height: 0, overflow: "hidden" }}>
        <label htmlFor={`${uid}-website`}>Leave this empty</label>
        <input
          id={`${uid}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? <Spinner label="Sending…" /> : "Send message"}
      </button>
    </form>
  );
}
