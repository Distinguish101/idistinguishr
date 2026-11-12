import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { POST } from "@/app/api/teacher/photo/route";
import { signInAs, signOut } from "../helpers/auth-mock";
import { clearStorageEnv, JPEG_BYTES, PNG_BYTES, startFakeS3, useStorageEnv, WEBP_BYTES } from "../helpers/fake-s3";
import { formRequest, readJson } from "../helpers/http";

let s3: Awaited<ReturnType<typeof startFakeS3>>;
let userId: string;

/** A JPEG-looking file of exactly `size` bytes. */
const jpegOfSize = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_BYTES);
  return bytes;
};

function upload(bytes: Uint8Array | string, o: { name?: string; type?: string; field?: string; headers?: Record<string, string> } = {}) {
  const form = new FormData();
  form.set(o.field ?? "photo", new File([bytes as BlobPart], o.name ?? "me.jpg", { type: o.type ?? "image/jpeg" }));
  return POST(formRequest("/api/teacher/photo", form, o.headers));
}

beforeAll(async () => {
  s3 = await startFakeS3();
});
afterAll(async () => {
  clearStorageEnv();
  await s3.close();
});
beforeEach(() => {
  s3.clear();
  useStorageEnv(s3.endpoint);
  userId = randomUUID(); // a fresh instructor each test, so the hourly limit never carries over
  signInAs({ id: userId, role: "TEACHER" });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/teacher/photo", () => {
  it("stores a JPEG under the instructor's folder and returns its public URL", async () => {
    const res = await upload(JPEG_BYTES);
    expect(res.status).toBe(200);
    const { url } = await readJson(res);
    expect(url).toMatch(new RegExp(`^https://images\\.example\\.test/photos/${userId}/[0-9a-f-]{36}\\.jpg$`));

    const [put] = s3.puts();
    expect(put.url).toBe(`/test-bucket/${url.replace("https://images.example.test/", "")}`);
    expect(put.headers["content-type"]).toBe("image/jpeg");
    expect(new Uint8Array(put.body)).toEqual(JPEG_BYTES);
  });

  it("accepts PNG and WebP, naming the file after what it really is", async () => {
    expect((await readJson(await upload(PNG_BYTES, { name: "a.png", type: "image/png" }))).url).toMatch(/\.png$/);
    expect((await readJson(await upload(WEBP_BYTES, { name: "a.webp", type: "image/webp" }))).url).toMatch(/\.webp$/);
    expect(s3.puts().map((r) => r.headers["content-type"])).toEqual(["image/png", "image/webp"]);
  });

  it("trusts the file's bytes, not its name or claimed type", async () => {
    const res = await upload(PNG_BYTES, { name: "holiday.jpg", type: "image/jpeg" });
    expect((await readJson(res)).url).toMatch(/\.png$/);
    expect(s3.puts()[0].headers["content-type"]).toBe("image/png");
  });

  it("gives every upload its own unguessable name", async () => {
    const a = (await readJson(await upload(JPEG_BYTES))).url;
    const b = (await readJson(await upload(JPEG_BYTES))).url;
    expect(a).not.toBe(b);
  });

  it.each([
    ["plain text named .jpg", "just some text", "me.jpg", "image/jpeg"],
    ["an SVG (can carry scripts)", "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "me.svg", "image/svg+xml"],
    ["HTML", "<html><script>alert(1)</script></html>", "me.jpg", "image/jpeg"],
    ["a GIF", "GIF89a......", "me.gif", "image/gif"],
  ])("400 for %s", async (_label, content, name, type) => {
    const res = await upload(content, { name, type });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/JPG, PNG or WebP/);
    expect(s3.requests).toHaveLength(0);
  });

  it("400 when no file, an empty file, or the wrong field is sent", async () => {
    const empty = new FormData();
    expect((await POST(formRequest("/x", empty))).status).toBe(400);
    expect((await upload(new Uint8Array(0))).status).toBe(400);
    expect((await upload(JPEG_BYTES, { field: "image" })).status).toBe(400);
    const textField = new FormData();
    textField.set("photo", "not a file");
    expect((await POST(formRequest("/x", textField))).status).toBe(400);
    expect(s3.requests).toHaveLength(0);
  });

  it("400 when the body is not a form at all", async () => {
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: "plain", headers: { "Content-Type": "text/plain" } }));
    expect(res.status).toBe(400);
  });

  it("accepts a file of exactly 2 MB, and refuses one byte more with 413", async () => {
    expect((await upload(jpegOfSize(2 * 1024 * 1024))).status).toBe(200);
    const res = await upload(jpegOfSize(2 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect((await readJson(res)).error).toMatch(/too large/);
    expect(s3.puts()).toHaveLength(1);
  });

  it("refuses a request that declares a huge body before reading it", async () => {
    const res = await upload(JPEG_BYTES, { headers: { "content-length": String(50 * 1024 * 1024) } });
    expect(res.status).toBe(413);
    expect(s3.requests).toHaveLength(0);
  });

  it("is for signed-in instructors only", async () => {
    signOut();
    expect((await upload(JPEG_BYTES)).status).toBe(401);
    signInAs({ id: userId, role: "STUDENT" });
    expect((await upload(JPEG_BYTES)).status).toBe(403);
    expect(s3.requests).toHaveLength(0);
  });

  it("503 while photo storage is not configured", async () => {
    clearStorageEnv();
    const res = await upload(JPEG_BYTES);
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toMatch(/isn't available yet/);
  });

  it("502 with a friendly message when storage rejects the upload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    s3.failWith(403);
    const res = await upload(JPEG_BYTES);
    expect(res.status).toBe(502);
    const body = await readJson(res);
    expect(body.error).toMatch(/couldn't save your photo/);
    expect(body.url).toBeUndefined();
  });

  it("allows 10 uploads an hour per instructor, then 429", async () => {
    for (let i = 0; i < 10; i++) expect((await upload(JPEG_BYTES)).status).toBe(200);
    const res = await upload(JPEG_BYTES);
    expect(res.status).toBe(429);
    expect((await readJson(res)).error).toMatch(/try again in an hour/);
    expect(s3.puts()).toHaveLength(10);

    signInAs({ id: randomUUID(), role: "TEACHER" }); // someone else is unaffected
    expect((await upload(JPEG_BYTES)).status).toBe(200);
  });

  it("lets the same instructor upload again after the hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    for (let i = 0; i < 10; i++) await upload(JPEG_BYTES);
    expect((await upload(JPEG_BYTES)).status).toBe(429);
    vi.setSystemTime(new Date("2026-11-04T11:00:01Z"));
    expect((await upload(JPEG_BYTES)).status).toBe(200);
  });

  it("counts rejected files towards the limit too", async () => {
    for (let i = 0; i < 12; i++) await upload("not an image");
    expect((await upload(JPEG_BYTES)).status).toBe(429);
  });
});
