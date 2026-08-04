// SCREEN 6 — Payment / Checkout
// Covers: US-15 (order summary), US-16 (payment + failure handling), US-17 (cancellation policy)
// Reference mockup: mockups.html → #payment
// Reference spec: booking-flow-spec.md → "6. Payment / Checkout"
// Reference: idistinguishr-stripe-connect-research.md
//
// TODO:
// - Order summary from the PENDING_PAYMENT Booking
// - Create a Stripe PaymentIntent (destination charge → teacher's connected
//   account, application fee = platform cut) — see Stripe Connect research doc
// - On success webhook: Booking.status → CONFIRMED, create Payment row with
//   platformFeeMinorUnits / teacherPayoutMinorUnits split
// - On failure: keep Booking as PENDING_PAYMENT (or release slot per US-33
//   expiry), show retry
// - Show 48hr cancellation policy (cancellationWindowHours on the booking)

export default function CheckoutPage() {
  return (
    <main>
      <h1>Payment</h1>
      <p>Order summary + Stripe payment form. See TODO comments above.</p>
    </main>
  );
}
