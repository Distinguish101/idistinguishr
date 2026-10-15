"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { displayInstruments } from "@/lib/instruments";
import { StarIcon } from "@/components/InstrumentIcon";

type CarouselTeacher = {
  id: string;
  fullName: string;
  instruments: string[];
  avgRating: number;
  hourlyRateMinorUnits: number;
  photoUrl: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Horizontal scroller, not a JS carousel library — the track is a plain flex
// row with CSS scroll-snap, so swiping/dragging on mobile and the arrow
// buttons both just call scrollBy on the same element.
//
// It advances by itself, which WCAG 2.2.2 says must be pausable: it stops while
// the pointer or keyboard focus is inside, and doesn't auto-advance at all for
// people who've asked their device for reduced motion.
export function TeacherCarousel({ teachers }: { teachers: CarouselTeacher[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (teachers.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track || pausedRef.current) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + track.clientWidth,
        behavior: "smooth",
      });
    }, 4500);
    return () => clearInterval(id);
  }, [teachers.length]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div
      className="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Top-rated instructors"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
      onTouchEnd={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
    >
      <div className="carousel-track" ref={trackRef}>
        {teachers.map((t) => (
          <Link
            key={t.id}
            href={`/teachers/${t.id}`}
            className="tcard carousel-card"
          >
            <div className="photo">
              {t.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- teacher-submitted URL, any host
                <img src={t.photoUrl} alt="" />
              ) : (
                <span aria-hidden="true">{initials(t.fullName)}</span>
              )}
            </div>
            <div className="body">
              <div className="name">{t.fullName}</div>
              <div className="inst">{displayInstruments(t.instruments)}</div>
              <div className="meta">
                <span className="note-rating" aria-label={`Rated ${t.avgRating.toFixed(1)} out of 5`}>
                  <StarIcon size={16} />
                  {t.avgRating.toFixed(1)}
                </span>
                <span className="rate">£{(t.hourlyRateMinorUnits / 100).toFixed(0)}/hr</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {teachers.length > 1 && (
        <div className="carousel-nav">
          <button type="button" className="carousel-btn" onClick={() => scrollByPage(-1)} aria-label="Previous instructors">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className="carousel-btn" onClick={() => scrollByPage(1)} aria-label="Next instructors">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
