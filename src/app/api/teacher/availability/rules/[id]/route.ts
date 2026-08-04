import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedTeacherProfile } from "@/lib/require-teacher-profile";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getAuthedTeacherProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.availabilityRule.findUnique({ where: { id } });
  if (!existing || existing.teacherId !== profile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.availabilityRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
