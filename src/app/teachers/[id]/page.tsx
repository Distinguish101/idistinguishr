// SCREEN 3 — Teacher Profile
// Covers: US-06 (bio/credentials/rate), US-07 (reviews), US-08 (availability preview)
// Reference mockup: mockups.html → #profile
// Reference spec: booking-flow-spec.md → "3. Teacher Profile"
//
// TODO:
// - Fetch TeacherProfile by id, include reviews (paginated) and a computed
//   next-N-days availability preview (apply AvailabilityException on top of
//   AvailabilityRule — do not pre-generate slot rows, compute at request time)
// - "Select a Time" CTA → /book/[teacherId]

export default function TeacherProfilePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main>
      <h1>Teacher Profile — {params.id}</h1>
      <p>Bio, credentials, reviews, availability preview. See TODO comments above.</p>
    </main>
  );
}
