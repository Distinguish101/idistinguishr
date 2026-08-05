import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// US-30: manual teacher approval. PATCH rather than a POST-per-action
// route since this is one field transition with two directions, not
// separate business operations like booking cancel/refund.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body?.approvalStatus !== "APPROVED" && body?.approvalStatus !== "REJECTED") {
    return NextResponse.json({ error: "approvalStatus must be APPROVED or REJECTED" }, { status: 400 });
  }

  const { id } = await params;
  const profile = await prisma.teacherProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  await prisma.teacherProfile.update({
    where: { id },
    data: { approvalStatus: body.approvalStatus },
  });

  return NextResponse.json({ ok: true });
}
