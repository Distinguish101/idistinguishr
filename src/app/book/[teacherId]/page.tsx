// SCREEN 4 — Select Time Slot
// Covers: US-09 (pick real availability), US-10 (length/format), US-11 (price preview)
// Reference mockup: mockups.html → #timeselect
// Reference spec: booking-flow-spec.md → "4. Select Time Slot"
//
// TODO:
// - Compute bookable slots (AvailabilityRule minus AvailabilityException minus
//   existing non-cancelled Bookings) for the selected date
// - On slot select: create a Booking row immediately with status=PENDING_PAYMENT
//   and a short expiry (soft-hold) — see data model doc, US-32/US-33
// - "Continue" → /auth (or straight to /checkout if already authenticated),
//   carrying the booking id forward

export default function TimeSelectPage({
  params,
}: {
  params: { teacherId: string };
}) {
  return (
    <main>
      <h1>Select a Time — {params.teacherId}</h1>
      <p>Calendar + time slots + length/format. See TODO comments above.</p>
    </main>
  );
}
