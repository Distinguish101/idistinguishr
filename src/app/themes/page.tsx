// Theme preview / living style guide. Renders the real home view and a sampler
// of the shared components with made-up data (no database), so any theme can be
// checked in one place, including by the automated accessibility scans. Not
// linked from the site and kept out of search results.
import type { Metadata } from "next";
import { HomeView, type FeaturedTeacher } from "@/components/HomeView";
import { InstrumentIcon, StarIcon } from "@/components/InstrumentIcon";

export const metadata: Metadata = {
  title: "Themes — IDistinguishR",
  robots: { index: false, follow: false },
};

const INSTRUMENTS = ["guitar", "piano", "violin", "drums", "voice"];

const FEATURED: FeaturedTeacher[] = [
  { id: "1", fullName: "Maya Okonkwo", instruments: ["piano"], avgRating: 4.9, hourlyRateMinorUnits: 4500, photoUrl: null },
  { id: "2", fullName: "Priya Shah", instruments: ["violin"], avgRating: 4.8, hourlyRateMinorUnits: 3800, photoUrl: null },
  { id: "3", fullName: "Tomasz Wiśniewski", instruments: ["guitar", "voice"], avgRating: 4.7, hourlyRateMinorUnits: 4000, photoUrl: null },
  { id: "4", fullName: "Ben Whitfield", instruments: ["voice"], avgRating: 4.6, hourlyRateMinorUnits: 3500, photoUrl: null },
];

export default function ThemesPage() {
  return (
    <>
      <HomeView instruments={INSTRUMENTS} featured={FEATURED} />

      <section className="wrap" aria-labelledby="samples-title" style={{ paddingTop: 56 }}>
        <h2 className="section-title" id="samples-title">
          Component samples
        </h2>
        <p className="t-soft" style={{ margin: "8px 0 24px" }}>
          Sample data only. Use the Theme menu in the header to switch.
        </p>

        <h3 style={{ margin: "24px 0 12px" }}>Buttons and badges</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn btn-primary" disabled>
            Disabled
          </button>
          <span className="badge">Online</span>
          <span className="badge badge-pending">Pending</span>
          <span className="badge badge-approved">Approved</span>
          <span className="badge badge-rejected">Rejected</span>
        </div>

        <h3 style={{ margin: "32px 0 12px" }}>Form fields</h3>
        <form className="card" style={{ maxWidth: 460 }} onSubmit={undefined}>
          <div className="field">
            <label htmlFor="s-email">Email</label>
            <input id="s-email" type="email" defaultValue="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="s-pass">Password</label>
            <input id="s-pass" type="password" defaultValue="password1" aria-describedby="s-pass-hint" />
            <p className="field-hint" id="s-pass-hint">
              At least 8 characters, with a letter and a number.
            </p>
          </div>
          <div className="field">
            <label htmlFor="s-role">I am a…</label>
            <select id="s-role" defaultValue="student">
              <option value="student">Student, looking for lessons</option>
              <option value="instructor">Instructor, offering lessons</option>
            </select>
          </div>
          <p className="field-error" role="alert">
            Incorrect email or password. Check them and try again.
          </p>
          <button type="button" className="btn btn-primary btn-block">
            Log in
          </button>
        </form>

        <h3 style={{ margin: "32px 0 12px" }}>Results card and lesson row</h3>
        <div className="rlist" style={{ maxWidth: 760 }}>
          <a className="rcard" href="#samples-title">
            <div className="photo">
              <span aria-hidden="true">MO</span>
            </div>
            <div>
              <div className="name">Maya Okonkwo</div>
              <div className="desc">Classically trained pianist teaching grades 1–8, jazz and improvisation to all ages.</div>
              <div className="tag-row">
                <span className="badge">Online</span>
                <span className="badge">In person</span>
              </div>
            </div>
            <div className="side">
              <div className="note-rating" aria-label="Rated 4.9 out of 5, 21 reviews">
                <StarIcon size={16} />
                4.9 (21)
              </div>
              <div className="price">£45/hr</div>
            </div>
          </a>
          <div className="lesson-row">
            <div className="lesson-date">
              <div className="d">22</div>
              <div className="m">Oct</div>
            </div>
            <div className="lesson-info">
              <div className="who">Priya Shah</div>
              <div className="when">Thu 18:30 · 60 min · Online</div>
            </div>
            <div>
              <button className="ghost-btn">Cancel</button>
            </div>
          </div>
        </div>

        <h3 style={{ margin: "32px 0 12px" }}>Booking controls</h3>
        <div style={{ maxWidth: 420 }}>
          <div className="opt-row" role="group" aria-label="Lesson length">
            <button className="opt-pill">30 min</button>
            <button className="opt-pill sel" aria-pressed="true">
              60 min
            </button>
          </div>
          <div className="time-slots" role="group" aria-label="Available times">
            <button className="tslot">17:00</button>
            <button className="tslot sel" aria-pressed="true">
              18:30
            </button>
            <button className="tslot">19:30</button>
            <button className="tslot" disabled>
              20:30
            </button>
          </div>
        </div>

        <h3 style={{ margin: "32px 0 12px" }}>Instrument icons</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", color: "var(--primary)" }}>
          {INSTRUMENTS.map((i) => (
            <InstrumentIcon key={i} name={i} size={40} />
          ))}
          <InstrumentIcon name="other" size={40} />
        </div>
      </section>
    </>
  );
}
