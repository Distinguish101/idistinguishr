// SCREEN 1 — Homepage
// Covers: US-01 (search by instrument + location), US-02 (featured teachers)
// Reference mockup: mockups.html → #homepage
// Reference spec: booking-flow-spec.md → "1. Homepage"
//
// TODO:
// - Search form (instrument select + location/online input) → submit routes
//   to /results with query params
// - Featured teachers section, pulling top-rated approved+onboarded teachers

export default function HomePage() {
  return (
    <main>
      <h1>IDistinguishR</h1>
      <p>Homepage — search + featured teachers. See TODO comments above.</p>
    </main>
  );
}
