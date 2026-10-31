import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePhotoByUrl,
  keyFromPublicUrl,
  putObject,
  storageConfig,
  storageEnabled,
  userPhotoPrefix,
} from "@/lib/storage";
import { clearStorageEnv, startFakeS3, useStorageEnv, JPEG_BYTES } from "../helpers/fake-s3";

describe("storage configuration", () => {
  afterEach(clearStorageEnv);

  it("is off until all five settings exist", () => {
    clearStorageEnv();
    expect(storageConfig()).toBeNull();
    expect(storageEnabled()).toBe(false);

    useStorageEnv("http://example.test");
    for (const key of [
      "STORAGE_ENDPOINT",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
      "STORAGE_PUBLIC_URL",
    ]) {
      const value = process.env[key];
      delete process.env[key];
      expect(storageEnabled(), `without ${key}`).toBe(false);
      process.env[key] = value;
    }
    expect(storageEnabled()).toBe(true);
  });

  it("trims trailing slashes and defaults the region to auto", () => {
    useStorageEnv("http://example.test///");
    process.env.STORAGE_PUBLIC_URL = "https://images.example.test//";
    const cfg = storageConfig()!;
    expect(cfg.endpoint).toBe("http://example.test");
    expect(cfg.publicUrl).toBe("https://images.example.test");
    expect(cfg.region).toBe("auto");
    process.env.STORAGE_REGION = "eu-west-2";
    expect(storageConfig()!.region).toBe("eu-west-2");
    delete process.env.STORAGE_REGION;
  });

  it("builds the per-user folder in the public URL space", () => {
    useStorageEnv("http://example.test");
    expect(userPhotoPrefix(storageConfig()!, "user-1")).toBe("https://images.example.test/photos/user-1/");
  });
});

describe("keyFromPublicUrl", () => {
  beforeEach(() => useStorageEnv("http://example.test"));
  afterEach(clearStorageEnv);

  it("returns the key for one of our photo URLs", () => {
    expect(keyFromPublicUrl("https://images.example.test/photos/u1/a.jpg")).toBe("photos/u1/a.jpg");
  });

  it("returns null for other hosts, other folders, or empty input", () => {
    expect(keyFromPublicUrl("https://evil.test/photos/u1/a.jpg")).toBeNull();
    expect(keyFromPublicUrl("https://images.example.test/other/u1/a.jpg")).toBeNull();
    expect(keyFromPublicUrl("https://images.example.test.evil.test/photos/u1/a.jpg")).toBeNull();
    expect(keyFromPublicUrl("")).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
    expect(keyFromPublicUrl(undefined)).toBeNull();
  });

  it("returns null when storage is not configured", () => {
    clearStorageEnv();
    expect(keyFromPublicUrl("https://images.example.test/photos/u1/a.jpg")).toBeNull();
  });
});

describe("putObject / deletePhotoByUrl against an S3-compatible server", () => {
  let s3: Awaited<ReturnType<typeof startFakeS3>>;

  beforeAll(async () => {
    s3 = await startFakeS3();
  });
  afterAll(() => s3.close());
  beforeEach(() => {
    s3.clear();
    useStorageEnv(s3.endpoint);
  });
  afterEach(clearStorageEnv);

  it("uploads signed bytes with the right headers and returns the public URL", async () => {
    const url = await putObject("photos/u1/abc.jpg", JPEG_BYTES, "image/jpeg");

    expect(url).toBe("https://images.example.test/photos/u1/abc.jpg");
    const [req] = s3.puts();
    expect(req.url).toBe("/test-bucket/photos/u1/abc.jpg");
    expect(req.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=TESTKEYID\//);
    expect(req.headers["content-type"]).toBe("image/jpeg");
    expect(req.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(req.body)).toEqual(JPEG_BYTES);
  });

  it("throws a descriptive error when the server rejects the upload", async () => {
    s3.failWith(403);
    await expect(putObject("photos/u1/abc.jpg", JPEG_BYTES, "image/jpeg")).rejects.toThrow(/Storage upload failed \(403\)/);
  });

  it("refuses to upload when storage is not configured", async () => {
    clearStorageEnv();
    await expect(putObject("photos/u1/abc.jpg", JPEG_BYTES, "image/jpeg")).rejects.toThrow(/not configured/);
    expect(s3.requests).toHaveLength(0);
  });

  it("deletes our own photo by its public URL", async () => {
    await deletePhotoByUrl("https://images.example.test/photos/u1/abc.jpg");
    const [req] = s3.deletes();
    expect(req.url).toBe("/test-bucket/photos/u1/abc.jpg");
    expect(req.headers.authorization).toMatch(/^AWS4-HMAC-SHA256/);
  });

  it("ignores URLs that are not ours, and empty values", async () => {
    await deletePhotoByUrl("https://elsewhere.test/photos/u1/abc.jpg");
    await deletePhotoByUrl("https://images.example.test/not-photos/x.jpg");
    await deletePhotoByUrl(null);
    await deletePhotoByUrl(undefined);
    expect(s3.requests).toHaveLength(0);
  });

  it("never throws when the delete fails, but logs it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    s3.failWith(500);
    await expect(deletePhotoByUrl("https://images.example.test/photos/u1/abc.jpg")).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it("treats an already-deleted file (404) as fine and does not log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    s3.failWith(404);
    await deletePhotoByUrl("https://images.example.test/photos/u1/abc.jpg");
    expect(err).not.toHaveBeenCalled();
  });

  it("never throws when the server is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.STORAGE_ENDPOINT = "http://127.0.0.1:1"; // nothing listens here
    await expect(deletePhotoByUrl("https://images.example.test/photos/u1/abc.jpg")).resolves.toBeUndefined();
  });
});
