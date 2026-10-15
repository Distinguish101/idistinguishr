// SCREEN 1 — Homepage
// Covers: US-01 (search by instrument + location), US-02 (featured teachers)
// Reference mockup: mockups.html → #homepage
// Reference spec: booking-flow-spec.md → "1. Homepage"
//
// Data fetching only; the markup lives in HomeView so the /themes preview page
// can render the same view with sample data.

import { getInstrumentOptions, getFeaturedTeachers } from "@/lib/teacher-search";
import { HomeView } from "@/components/HomeView";

export default async function HomePage() {
  const [instruments, featured] = await Promise.all([getInstrumentOptions(), getFeaturedTeachers(8)]);

  return (
    <HomeView
      instruments={instruments}
      featured={featured.map((t) => ({
        id: t.id,
        fullName: t.user.fullName,
        instruments: t.instruments,
        avgRating: Number(t.avgRating),
        hourlyRateMinorUnits: t.hourlyRateMinorUnits,
        photoUrl: t.photoUrl,
      }))}
    />
  );
}
