import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { newResetToken, RESET_MAX_PER_HOUR, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

// Always the same response whether or not the address has an account, so the
// form can't be used to discover who is registered.
const GENERIC = { ok: true };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Google-only accounts have no password to reset; suspended and deleted
  // accounts get nothing. Deactivated ones can reset (logging in reactivates).
  if (!user || !user.passwordHash || user.status === "SUSPENDED" || user.status === "DELETED") {
    return NextResponse.json(GENERIC);
  }

  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= RESET_MAX_PER_HOUR) {
    return NextResponse.json(GENERIC);
  }

  const { token, tokenHash } = newResetToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  // Not awaited: keeps response time the same for existing and unknown
  // addresses. sendPasswordResetEmail catches and logs its own errors.
  void sendPasswordResetEmail({ to: user.email, fullName: user.fullName, token });

  return NextResponse.json(GENERIC);
}
