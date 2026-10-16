import { AwsClient } from "aws4fetch";

// File storage for instructor photos, talking to any S3-compatible service
// (Cloudflare R2 is the intended one; Oracle Object Storage, Backblaze B2 and
// others speak the same protocol, so switching is a settings change).
//
// Everything is optional: until the five STORAGE_* settings exist,
// storageConfig() returns null, uploads are switched off, and the profile form
// falls back to pasting a photo link. See docs/photo-storage-setup.md.

export type StorageConfig = {
  endpoint: string; // e.g. https://<account id>.r2.cloudflarestorage.com
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string; // "auto" for R2
  publicUrl: string; // where browsers load files from, e.g. https://images.idistinguishr.com
};

export function storageConfig(): StorageConfig | null {
  const e = process.env;
  if (
    !e.STORAGE_ENDPOINT ||
    !e.STORAGE_BUCKET ||
    !e.STORAGE_ACCESS_KEY_ID ||
    !e.STORAGE_SECRET_ACCESS_KEY ||
    !e.STORAGE_PUBLIC_URL
  ) {
    return null;
  }
  return {
    endpoint: e.STORAGE_ENDPOINT.replace(/\/+$/, ""),
    bucket: e.STORAGE_BUCKET,
    accessKeyId: e.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: e.STORAGE_SECRET_ACCESS_KEY,
    region: e.STORAGE_REGION || "auto",
    publicUrl: e.STORAGE_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

export function storageEnabled(): boolean {
  return storageConfig() !== null;
}

function client(cfg: StorageConfig) {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: cfg.region,
  });
}

function objectUrl(cfg: StorageConfig, key: string) {
  return `${cfg.endpoint}/${cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The folder, in the public URL space, that belongs to one user's photos. */
export function userPhotoPrefix(cfg: StorageConfig, userId: string) {
  return `${cfg.publicUrl}/photos/${userId}/`;
}

/** Uploads one object and returns the public URL it will be served from. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const cfg = storageConfig();
  if (!cfg) throw new Error("File storage is not configured");

  const res = await client(cfg).fetch(objectUrl(cfg, key), {
    method: "PUT",
    body: body as unknown as BodyInit,
    headers: {
      "Content-Type": contentType,
      // Keys are random and never reused, so the file can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Storage upload failed (${res.status}) ${detail}`);
  }
  return `${cfg.publicUrl}/${key}`;
}

/** The storage key behind a public URL of ours, or null if it isn't one of ours. */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  const cfg = storageConfig();
  if (!cfg || !url || !url.startsWith(`${cfg.publicUrl}/`)) return null;
  const key = url.slice(cfg.publicUrl.length + 1);
  return key.startsWith("photos/") ? key : null;
}

/** Best-effort delete of a photo we uploaded. Never throws: a leftover file is harmless. */
export async function deletePhotoByUrl(url: string | null | undefined): Promise<void> {
  const cfg = storageConfig();
  const key = keyFromPublicUrl(url);
  if (!cfg || !key) return;
  try {
    const res = await client(cfg).fetch(objectUrl(cfg, key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) console.error(`Photo delete failed (${res.status}) for ${key}`);
  } catch (err) {
    console.error("Photo delete failed:", err);
  }
}
