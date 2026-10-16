"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { Spinner } from "@/components/Spinner";

const MAX_INPUT_BYTES = 25 * 1024 * 1024; // what we'll try to open in the browser
const MAX_SIDE = 1200; // longest side after shrinking, in pixels

// Shrinks a picture in the browser before upload: caps its size, flattens
// transparency onto white, and re-encodes it as a JPEG. Re-encoding also drops
// hidden metadata (such as the GPS location phones add to photos), and means
// uploads are a few hundred KB instead of several MB.
async function shrinkToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85)
  );
}

export function PhotoUpload({
  value,
  onChange,
  fallbackLabel,
}: {
  value: string;
  onChange: (url: string) => void;
  fallbackLabel: string; // initials shown when there's no photo yet
}) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;

    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That file is too large. Please choose one under 25 MB.");
      return;
    }

    setBusy(true);
    try {
      const blob = await shrinkToJpeg(file);
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      const res = await fetch("/api/teacher/photo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't upload your photo. Please try again.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("We couldn't read that image. Please try a different one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field" role="group" aria-labelledby={`${uid}-label`}>
      <span className="field-label" id={`${uid}-label`}>
        Profile photo
      </span>
      <div className="photo-upload">
        <div className="photo-upload-preview">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own uploaded file
            <img src={value} alt="Your profile photo" />
          ) : (
            <span aria-hidden="true">{fallbackLabel}</span>
          )}
        </div>
        <div className="photo-upload-actions">
          <input
            ref={inputRef}
            id={`${uid}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            className="sr-only"
            aria-describedby={`${uid}-hint`}
            disabled={busy}
          />
          <label htmlFor={`${uid}-file`} className="btn btn-secondary" aria-disabled={busy}>
            {busy ? <Spinner label="Uploading…" /> : value ? "Change photo" : "Choose a photo"}
          </label>
          {value && !busy && (
            <button type="button" className="btn btn-ghost" onClick={() => onChange("")}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      <p className="field-hint" id={`${uid}-hint`}>
        JPG, PNG or WebP. We resize it for you. Your photo is saved when you press Save changes.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
