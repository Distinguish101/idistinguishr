// SCREEN 7 — Booking Confirmation
// Covers: US-18 (confirmation), US-19 (add to calendar), US-20 (email confirmation)
// Reference mockup: mockups.html → #confirm
// Reference spec: booking-flow-spec.md → "7. Booking Confirmation"
//
// TODO:
// - Fetch confirmed Booking by id, show summary
// - "Add to Calendar" — generate .ics or Google Calendar link
// - Trigger confirmation email (on the payment-success webhook, not here —
//   this page should just reflect state, not cause side effects on load)
// - "Go to Dashboard" CTA

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <main>
      <h1>You're booked! — {bookingId}</h1>
      <p>Booking summary + add to calendar. See TODO comments above.</p>
    </main>
  );
}
