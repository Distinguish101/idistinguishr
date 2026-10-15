// SCREEN 1 — Homepage
// Covers: US-01 (search by instrument + location), US-02 (featured teachers)
// Reference mockup: mockups.html → #homepage
// Reference spec: booking-flow-spec.md → "1. Homepage"
//
// The same markup serves all three themes (see globals.css, "Theme
// structure"): the hero's copy, search and photo are separate grid children so
// each theme can arrange them differently.

import Image from "next/image";
import Link from "next/link";
import { TeacherCarousel } from "@/components/TeacherCarousel";
import { InstrumentIcon } from "@/components/InstrumentIcon";
import { displayInstrument } from "@/lib/instruments";

export type FeaturedTeacher = {
  id: string;
  fullName: string;
  instruments: string[];
  avgRating: number;
  hourlyRateMinorUnits: number;
  photoUrl: string | null;
};

export function HomeView({ instruments, featured }: { instruments: string[]; featured: FeaturedTeacher[] }) {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="hero-h1" id="hero-title">
              Find an instructor who makes you want to practise.
            </h1>
            <p className="hero-sub">
              Search real instructors by instrument, price, and availability — book a lesson in
              minutes, online or in person.
            </p>
          </div>

          <form action="/results" method="get" className="search-card" role="search" aria-label="Find an instructor">
            <div className="field">
              <label htmlFor="home-instrument">Instrument</label>
              <select id="home-instrument" name="instrument" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {instruments.map((i) => (
                  <option key={i} value={i}>
                    {displayInstrument(i)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="home-location">Location or online</label>
              <input id="home-location" name="location" placeholder="Edinburgh, or 'Online'" autoComplete="off" />
            </div>
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>

          <div className="hero-art">
            <Image
              src="https://images.unsplash.com/photo-1758524944402-1903b38f848f?fm=jpg&q=80&w=1200&auto=format&fit=crop"
              alt="An instructor guiding a student through a guitar lesson"
              width={1200}
              height={800}
              sizes="(max-width: 680px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className="instruments" aria-labelledby="instruments-title">
        <div className="wrap">
          <h2 className="section-title" id="instruments-title" style={{ marginBottom: 20 }}>
            Pick an instrument
          </h2>
          {instruments.length === 0 ? (
            <p className="empty-note">No instructors are live yet — check back soon.</p>
          ) : (
            <div className="chip-picker">
              {instruments.map((i) => (
                <Link key={i} href={`/results?instrument=${encodeURIComponent(i)}`}>
                  <span className="glyph">
                    <InstrumentIcon name={i} size={36} />
                  </span>
                  {displayInstrument(i)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <div className="wrap">
          <h2 className="section-title" id="how-title" style={{ marginBottom: 20 }}>
            How it works
          </h2>
          <ol className="steps">
            <li className="step">
              <div className="idx" aria-hidden="true">
                1
              </div>
              <h3>Search</h3>
              <p>Filter by instrument, price, and format to find instructors who fit your goals.</p>
            </li>
            <li className="step">
              <div className="idx" aria-hidden="true">
                2
              </div>
              <h3>Pick a time</h3>
              <p>Browse each instructor&apos;s live availability and choose a slot that works.</p>
            </li>
            <li className="step">
              <div className="idx" aria-hidden="true">
                3
              </div>
              <h3>Start learning</h3>
              <p>Book, pay securely, and join your first lesson — online or in person.</p>
            </li>
          </ol>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="featured" aria-labelledby="featured-title">
          <div className="wrap">
            <div className="section-head">
              <h2 className="section-title" id="featured-title">
                Top-rated this month
              </h2>
              <Link href="/results" className="featured-view-all">
                View all instructors
              </Link>
            </div>
            <TeacherCarousel
              teachers={featured.map((t) => ({
                id: t.id,
                fullName: t.fullName,
                instruments: t.instruments,
                avgRating: t.avgRating,
                hourlyRateMinorUnits: t.hourlyRateMinorUnits,
                photoUrl: t.photoUrl,
              }))}
            />
          </div>
        </section>
      )}
    </main>
  );
}
