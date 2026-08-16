"use client";

import { useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  student: { fullName: string };
};

type Tab = "about" | "availability" | "reviews";

// Client-only for the tab switch itself — all three panels' content is
// still server-fetched and passed in as props, so nothing here needs its
// own data fetching. Mirrors the tabbed layout on sites like Preply/Wyzant
// rather than the previous always-stacked sections.
export function ProfileTabs({
  bio,
  credentialLines,
  reviews,
  reviewCount,
  nextDates,
}: {
  bio: string;
  credentialLines: string[];
  reviews: Review[];
  reviewCount: number;
  nextDates: string[];
}) {
  const [tab, setTab] = useState<Tab>("about");

  return (
    <div>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "about"}
          className={`profile-tab-btn${tab === "about" ? " active" : ""}`}
          onClick={() => setTab("about")}
        >
          About
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "availability"}
          className={`profile-tab-btn${tab === "availability" ? " active" : ""}`}
          onClick={() => setTab("availability")}
        >
          Availability
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reviews"}
          className={`profile-tab-btn${tab === "reviews" ? " active" : ""}`}
          onClick={() => setTab("reviews")}
        >
          Reviews ({reviewCount})
        </button>
      </div>

      {tab === "about" && (
        <div className="profile-tab-panel">
          <div className="p-section" style={{ marginTop: 0 }}>
            <h3>About</h3>
            <p>{bio}</p>
          </div>
          <div className="p-section">
            <h3>Experience &amp; credentials</h3>
            <ul className="cred-list">
              {credentialLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "availability" && (
        <div className="profile-tab-panel">
          {nextDates.length > 0 ? (
            <>
              <p className="t-soft" style={{ marginBottom: 4 }}>
                Next {nextDates.length} open date{nextDates.length === 1 ? "" : "s"} — book to see exact times.
              </p>
              <div className="mini-cal mini-cal-lg">
                {nextDates.map((d) => (
                  <div key={d} className="open">
                    {new Date(d).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                    <br />
                    {new Date(d).getUTCDate()}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="t-soft">No open slots in the next two weeks — check back soon.</p>
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div className="profile-tab-panel">
          {reviews.length === 0 ? (
            <p className="t-soft">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review">
                <div className="who">
                  {r.student.fullName} — {new Date(r.createdAt).toLocaleDateString("en-GB")}
                </div>
                <div className="note-rating" style={{ marginTop: 2 }}>
                  ♪♪♪♪♪ {r.rating}/5
                </div>
                {r.comment && <p>{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
