import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Express dashboard login links (US-28's "when will I be paid" — Stripe
// already has a full payout schedule/balance UI, no need to rebuild it).
// This is still stripe.accounts.createLoginLink, the classic v1-surface
// method — dashboard access for Express accounts wasn't moved under
// stripe.v2.core the way account creation was; it's keyed by account ID
// regardless of which API created the account.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const profile = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile?.stripeAccountId || !profile.stripeOnboardingComplete) {
    return NextResponse.redirect(new URL("/teacher/profile", req.url));
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);
  return NextResponse.redirect(loginLink.url);
}
