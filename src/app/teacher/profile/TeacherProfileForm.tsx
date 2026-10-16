"use client";

import { useState, type FormEvent, useId } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { displayInstruments } from "@/lib/instruments";
import { PhotoUpload } from "./PhotoUpload";

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

export function TeacherProfileForm({
  initial,
  uploadsEnabled = false,
  initials = "",
}: {
  initial: Profile;
  uploadsEnabled?: boolean;
  initials?: string;
}) {
  const uid = useId();
  const router = useRouter();
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [instruments, setInstruments] = useState(initial ? displayInstruments(initial.instruments) : "");
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
      <div className="field">
        <label htmlFor={`${uid}-1`}>Bio</label>
        <textarea id={`${uid}-1`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          required
          minLength={20}
          maxLength={2000}
          placeholder="Tell students about your teaching style and experience."
        />
      </div>

      <div className="field">
        <label htmlFor={`${uid}-2`}>Instruments (comma-separated)</label>
        <input id={`${uid}-2`}
          value={instruments}
          onChange={(e) => setInstruments(e.target.value)}
          required
          placeholder="Piano, Guitar"
        />
      </div>

      <div className="field">
        <label htmlFor={`${uid}-3`}>Hourly rate (£)</label>
        <input id={`${uid}-3`}
          type="number"
          min="1"
          step="0.5"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          required
        />
      </div>

      <div className="field" role="group" aria-labelledby={`${uid}-formats`}>
        <span className="field-label" id={`${uid}-formats`}>
          Formats offered
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          <label className="check-label">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Online
          </label>
          <label className="check-label">
            <input type="checkbox" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} /> In person
          </label>
        </div>
      </div>

      {inPerson && (
        <div className="field">
          <label htmlFor={`${uid}-4`}>Location</label>
          <input id={`${uid}-4`}
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="e.g. Clapham, London"
          />
        </div>
      )}

      {uploadsEnabled ? (
        <PhotoUpload
          value={photoUrl}
          onChange={(url) => {
            setPhotoUrl(url);
            setSaved(false);
          }}
          fallbackLabel={initials}
        />
      ) : (
        // Fallback while file storage isn't connected: paste a link.
        <div className="field">
          <label htmlFor={`${uid}-5`}>Photo URL</label>
          <input id={`${uid}-5`}
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://... (a link to a photo of you)"
          />
        </div>
      )}

      <div className="field">
        <label htmlFor={`${uid}-6`}>Credentials</label>
        <textarea id={`${uid}-6`}
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Qualifications, diplomas, notable experience."
        />
      </div>

      {error && <p className="field-error">{error}</p>}
      {saved && (
        <p role="status" style={{ color: "var(--success)", fontWeight: 600 }}>
          Saved.
        </p>
      )}

      {/* The approval status lives down here, next to the save button, not above
          the fields where it looked like a button and pushed the form down. */}
      <div className="form-footer">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner label="Saving…" /> : initial ? "Save changes" : "Create profile"}
        </button>
        {initial && (
          <p className="form-status">
            Status:{" "}
            <span className={`badge badge-${initial.approvalStatus.toLowerCase()}`}>
              {APPROVAL_LABEL[initial.approvalStatus]}
            </span>
          </p>
        )}
      </div>
    </form>
  );
}
