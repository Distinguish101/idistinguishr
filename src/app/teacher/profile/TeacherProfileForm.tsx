"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

type Profile = {
  bio: string;
  instruments: string[];
  hourlyRateMinorUnits: number;
  formatsOffered: ("ONLINE" | "IN_PERSON")[];
  locationText: string | null;
  credentials: string;
  photoUrl: string | null;
  approvalStatus: ApprovalStatus;
} | null;

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Live",
  REJECTED: "Rejected",
};

export function TeacherProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [instruments, setInstruments] = useState(initial?.instruments.join(", ") ?? "");
  const [hourlyRate, setHourlyRate] = useState(
    initial ? (initial.hourlyRateMinorUnits / 100).toString() : ""
  );
  const [online, setOnline] = useState(initial ? initial.formatsOffered.includes("ONLINE") : true);
  const [inPerson, setInPerson] = useState(initial?.formatsOffered.includes("IN_PERSON") ?? false);
  const [locationText, setLocationText] = useState(initial?.locationText ?? "");
  const [credentials, setCredentials] = useState(initial?.credentials ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const formatsOffered = [...(online ? ["ONLINE"] : []), ...(inPerson ? ["IN_PERSON"] : [])];
    if (formatsOffered.length === 0) {
      setError("Offer at least one format — online or in person.");
      return;
    }
    if (inPerson && !locationText.trim()) {
      setError("Add a location for in-person lessons.");
      return;
    }
    const rate = parseFloat(hourlyRate);
    if (!rate || rate <= 0) {
      setError("Enter a valid hourly rate.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/teacher/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio,
        instruments: instruments.split(",").map((i) => i.trim()).filter(Boolean),
        hourlyRate: rate,
        formatsOffered,
        locationText: inPerson ? locationText.trim() : null,
        credentials,
        photoUrl: photoUrl.trim() || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save your profile — try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {initial && (
        <div style={{ marginBottom: 20 }}>
          <span className={`badge badge-${initial.approvalStatus.toLowerCase()}`}>
            {APPROVAL_LABEL[initial.approvalStatus]}
          </span>
        </div>
      )}

      <div className="field">
        <label>Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          required
          minLength={20}
          maxLength={2000}
          placeholder="Tell students about your teaching style and experience."
        />
      </div>

      <div className="field">
        <label>Instruments (comma-separated)</label>
        <input
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
          required
          placeholder="Piano, Guitar"
        />
      </div>

      <div className="field">
        <label>Hourly rate (£)</label>
        <input
          type="number"
          min="1"
          step="0.5"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label>Formats offered</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Online
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} /> In
            person
          </label>
        </div>
      </div>

      {inPerson && (
        <div className="field">
          <label>Location</label>
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="e.g. Clapham, London"
          />
        </div>
      )}

      <div className="field">
        <label>Photo URL</label>
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://... (a link to a photo of you)"
        />
      </div>

      <div className="field">
        <label>Credentials</label>
        <textarea
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Qualifications, diplomas, notable experience."
        />
      </div>

      {error && <p className="field-error">{error}</p>}
      {saved && <p style={{ color: "var(--pine)", fontSize: 13 }}>Saved.</p>}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? <Spinner label="Saving…" /> : initial ? "Save changes" : "Create profile"}
      </button>
    </form>
  );
}
