// SCREEN 1 — Homepage
// Covers: US-01 (search by instrument + location), US-02 (featured teachers)
// Reference mockup: mockups.html → #homepage
// Reference spec: booking-flow-spec.md → "1. Homepage"

import Image from "next/image";
import Link from "next/link";
import { getInstrumentOptions, getFeaturedTeachers } from "@/lib/teacher-search";
import { TeacherCarousel } from "@/components/TeacherCarousel";

export default async function HomePage() {
  const [instruments, featured] = await Promise.all([getInstrumentOptions(), getFeaturedTeachers(8)]);

  return (
    <main>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Private lessons, any instrument</span>
            <h1 className="hero-h1">Find a teacher who makes you want to practice.</h1>
            <p className="hero-sub">
              Search real teachers by instrument, price, and availability — book a lesson in
              minutes, online or in person.
            </p>
            <form action="/results" method="get" className="search-card">
              <div className="field">
                <label>Instrument</label>
                <select name="instrument" required defaultValue="">
                  <option value="" disabled>
                    Choose an instrument
                  </option>
                  {instruments.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Location or Online</label>
                <input name="location" placeholder="Edinburgh, or 'Online'" />
              </div>
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
            {instruments.length === 0 && (
              <p className="field-hint" style={{ marginTop: 12 }}>
                No teachers are live yet — check back soon.
              </p>
            )}
          </div>
          <div className="hero-art">
            <Image
              src="https://images.unsplash.com/photo-1758524944402-1903b38f848f?fm=jpg&q=80&w=1200&auto=format&fit=crop"
              alt="A teacher guiding a student through a guitar lesson"
              width={800}
              height={800}
              priority
            />
            <div className="badge" aria-hidden="true">
              ♪
            </div>
          </div>
        </div>
      </section>

      <div className="staff wide" />

      <section className="how-it-works">
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <div className="steps">
            <div className="step">
              <div className="idx">01</div>
              <h3>Search</h3>
              <p>Filter by instrument, price, and format to find teachers who fit your goals.</p>
            </div>
            <div className="step">
              <div className="idx">02</div>
              <h3>Pick a time</h3>
              <p>Browse each teacher&apos;s live availability and choose a slot that works.</p>
            </div>
            <div className="step">
              <div className="idx">03</div>
              <h3>Start learning</h3>
              <p>Book, pay securely, and join your first lesson — online or in person.</p>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <>
          <div className="staff wide" />
          <section className="featured">
            <div className="wrap">
              <div className="featured-head">
                <h2 className="t-display-l">Top-rated this month</h2>
                <Link href="/results" className="featured-view-all">
                  View all →
                </Link>
              </div>
              <TeacherCarousel
                teachers={featured.map((t) => ({
                  id: t.id,
                  fullName: t.user.fullName,
                  instruments: t.instruments,
                  avgRating: Number(t.avgRating),
                  hourlyRateMinorUnits: t.hourlyRateMinorUnits,
                  photoUrl: t.photoUrl,
                }))}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
