import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { passwordIssue } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(72),
});

const INVALID = "This reset link is invalid or has expired. Request a new one.";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.status !== "ACTIVE") {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  const weakness = passwordIssue(password, record.user.email);
  if (weakness) {
    return NextResponse.json({ error: weakness }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Claim the token atomically so two concurrent submissions can't both win.
  const claimed = await prisma.$transaction(async (tx) => {
    const res = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (res.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    // Any other outstanding links for this account die with this reset.
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return true;
  });

  if (!claimed) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
