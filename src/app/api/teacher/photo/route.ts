import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { storageEnabled, putObject } from "@/lib/storage";
import { sniffPhotoType } from "@/lib/image-type";

// Instructor photo upload. The browser shrinks the picture first (to about
// 1200px, as a JPEG), so real uploads are a few hundred KB; the limits here
// are the server's own guard in case someone bypasses the page.
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PER_HOUR = 10;

const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= MAX_PER_HOUR) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Photo upload isn't available yet." }, { status: 503 });
  }
  const userId = session.user.id;

  // Refuse obviously oversized requests before reading the body.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });
  }
  if (limited(userId)) {
    return NextResponse.json({ error: "You've uploaded a lot of photos. Please try again in an hour." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffPhotoType(bytes);
  if (!type) {
    return NextResponse.json({ error: "Please upload a JPG, PNG or WebP image." }, { status: 400 });
  }

  try {
    const url = await putObject(`photos/${userId}/${randomUUID()}.${type.ext}`, bytes, type.mime);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Photo upload failed:", err);
    return NextResponse.json({ error: "We couldn't save your photo. Please try again." }, { status: 502 });
  }
}
