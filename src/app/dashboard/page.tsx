// SCREEN 8 — Dashboard
// Covers: US-21 (upcoming), US-22 (reschedule/cancel), US-23 (leave review), US-24 (empty state)
// Reference mockup: mockups.html → #dashboard
// Reference spec: booking-flow-spec.md → "8. Dashboard"
//
// TODO:
// - Require auth (redirect to /auth if no session)
// - Tabs: Upcoming / Past / Saved teachers
// - Upcoming: Bookings where status=CONFIRMED and lessonDate >= today
// - Cancel: only allowed if now < lessonDate - cancellationWindowHours;
//   sets status=CANCELLED, cancelledBy=STUDENT, cancelledAt=now
// - Past + completed + no existing Review → show "Leave a Review" prompt
// - Empty state when no bookings at all

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Upcoming/past lessons, reschedule/cancel, reviews. See TODO comments above.</p>
    </main>
  );
}
