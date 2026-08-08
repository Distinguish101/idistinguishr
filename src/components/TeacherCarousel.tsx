"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type CarouselTeacher = {
  id: string;
  fullName: string;
  instruments: string[];
  avgRating: number;
  hourlyRateMinorUnits: number;
  photoUrl: string | null;
};

// Auto-advancing horizontal scroller, not a JS carousel library — the
// track is a plain flex row with CSS scroll-snap, so swiping/dragging on
// mobile and the arrow buttons both just call scrollBy on the same
// element. Auto-advance pauses on hover/touch so it doesn't fight a user
// mid-swipe.
export function TeacherCarousel({ teachers }: { teachers: CarouselTeacher[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (teachers.length <= 1) return;
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
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
      onTouchEnd={() => (pausedRef.current = false)}
    >
      <div className="carousel-track" ref={trackRef}>
        {teachers.map((t) => (
          <Link key={t.id} href={`/teachers/${t.id}`} className="tcard carousel-card">
            <div className="photo">
              {t.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- teacher-submitted URL, any host
                <img src={t.photoUrl} alt={t.fullName} />
              )}
            </div>
            <div className="body">
              <div className="name">{t.fullName}</div>
              <div className="inst">{t.instruments.join(", ")}</div>
              <div className="meta">
                <span className="note-rating">♪♪♪♪♪ {t.avgRating.toFixed(1)}</span>
                <span className="rate">£{(t.hourlyRateMinorUnits / 100).toFixed(0)}/hr</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {teachers.length > 1 && (
        <div className="carousel-nav">
          <button type="button" className="carousel-btn" onClick={() => scrollByPage(-1)} aria-label="Previous">
            ←
          </button>
          <button type="button" className="carousel-btn" onClick={() => scrollByPage(1)} aria-label="Next">
            →
          </button>
        </div>
      )}
    </div>
  );
}
