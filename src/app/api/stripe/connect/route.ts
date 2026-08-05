import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Kicks off (or resumes) Stripe Express onboarding for the signed-in
// teacher — a plain GET so a simple <a href="/api/stripe/connect"> link
// works with no client JS, same pattern as the rest of this app's forms.
//
// Uses the Accounts v2 API (stripe.v2.core.accounts / accountLinks), not
// the older `stripe.accounts.create({ type: 'express' })` — that v1
// pattern is deprecated for new integrations. This is a marketplace, not
// a SaaS platform (the platform runs checkout and takes a cut, teachers
// don't run their own storefronts), so connected accounts only need the
// "recipient" configuration (able to receive transfers) — not "merchant"
// (that's for direct charges, not used here).
//
// stripeOnboardingComplete itself only flips once the webhook confirms it
// (see src/app/api/webhooks/stripe/route.ts) — this route just gets the
// teacher to Stripe's hosted onboarding UI.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (!profile) {
    return NextResponse.redirect(new URL("/teacher/profile", req.url));
  }

  let accountId = profile.stripeAccountId;
  if (!accountId) {
    const account = await stripe.v2.core.accounts.create({
      contact_email: profile.user.email,
      display_name: profile.user.fullName,
      dashboard: "express",
      identity: { country: "gb" },
      defaults: {
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      configuration: {
        recipient: {
          capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
        },
      },
    });
    accountId = account.id;
    await prisma.teacherProfile.update({
      where: { id: profile.id },
      data: { stripeAccountId: accountId },
    });
  }

  const origin = new URL(req.url).origin;
  const accountLink = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${origin}/api/stripe/connect`,
        return_url: `${origin}/teacher/profile`,
      },
    },
  });

  return NextResponse.redirect(accountLink.url);
}
