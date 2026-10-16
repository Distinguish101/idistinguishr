import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactMessageEmail } from "@/lib/email";
import { CONTACT_TOPICS } from "@/lib/contact";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10, "Please write at least a sentence.").max(4000),
  // Honeypot: hidden from people, filled in by simple bots.
  website: z.string().max(200).optional(),
});

// Small in-memory limiter per client address. Each pod has its own counter,
// which is fine here: the goal is to stop a script flooding the admin inbox,
// not to be an exact quota.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, email, topic, message, website } = parsed.data;

  // A filled honeypot gets the same "sent" answer, so bots learn nothing.
  if (website) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json(
      { error: "You've sent a few messages already. Please try again in an hour." },
      { status: 429 }
    );
  }

  const sent = await sendContactMessageEmail({ name, email, topic, message });
  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send your message just now. Please try again in a little while." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
