// SCREEN 2 — Results / Directory
// Covers: US-03 (filters), US-04 (sort), US-05 (empty state)
// Reference mockup: mockups.html → #results
// Reference spec: booking-flow-spec.md → "2. Results / Directory"
//
// TODO:
// - Read searchParams (instrument, location, price, rating, format, availability)
// - Query: only teachers where approvalStatus = APPROVED AND stripeOnboardingComplete = true
// - Filter sidebar + sort dropdown, client-state synced to URL
// - Empty state when no matches

export default function ResultsPage() {
  return (
    <main>
      <h1>Search Results</h1>
      <p>Directory of teachers with filters. See TODO comments above.</p>
    </main>
  );
}
