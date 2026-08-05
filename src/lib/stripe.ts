import Stripe from "stripe";

// Standard singleton pattern, same reasoning as src/lib/prisma.ts — avoids
// recreating the client (and its connection pool) on every hot-reload.
const globalForStripe = globalThis as unknown as { stripe: Stripe | undefined };

export const stripe = globalForStripe.stripe ?? new Stripe(process.env.STRIPE_SECRET_KEY!);

if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;

// Platform's own cut of each booking, taken via Stripe's application_fee_amount
// on the destination charge (see idistinguishr-stripe-connect-research.md —
// this is separate from Stripe's own processing fee, which the platform
// absorbs from this cut under the destination-charge model). Not a figure
// from Stripe's pricing page — it's our own business decision, left as an
// open item in the research doc; 10% is a reasonable MVP default and easy
// to change in one place.
export const PLATFORM_FEE_PERCENT = 10;

export function platformFeeForAmount(amountMinorUnits: number): number {
  return Math.round((amountMinorUnits * PLATFORM_FEE_PERCENT) / 100);
}
