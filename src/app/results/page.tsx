// SCREEN 2 — Results / Directory
// Covers: US-03 (filter by price/rating/format/availability), US-04 (sort),
// US-05 (empty state)
// Reference mockup: mockups.html → #results
// Reference spec: booking-flow-spec.md → "2. Results / Directory"
//
// Filters live entirely in the URL (two plain GET forms, no client JS) so
// results stay shareable/bookmarkable per the US-03 AC.

import Link from "next/link";
import { searchTeachers, getInstrumentOptions, type ResultsFilters } from "@/lib/teacher-search";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const instrument = first(sp.instrument) ?? "";
  const location = first(sp.location) ?? "";
  const minPriceRaw = first(sp.minPrice);
  const maxPriceRaw = first(sp.maxPrice);
  const minRatingRaw = first(sp.minRating);
  const minPrice = minPriceRaw ? Number(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;
  const minRating = minRatingRaw ? Number(minRatingRaw) : undefined;
  const formats = ([] as string[])
    .concat(sp.format ?? [])
    .filter((f): f is "ONLINE" | "IN_PERSON" => f === "ONLINE" || f === "IN_PERSON");
  const availableThisWeek = first(sp.availableThisWeek) === "1";
  const sort = (first(sp.sort) as ResultsFilters["sort"]) ?? "relevance";
  const page = first(sp.page) ? Number(first(sp.page)) : 1;

  const [instruments, { teachers, total, pageSize }] = await Promise.all([
    getInstrumentOptions(),
    searchTeachers({ instrument, location, minPrice, maxPrice, minRating, formats, availableThisWeek, sort, page }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (instrument) params.set("instrument", instrument);
    if (location) params.set("location", location);
    if (minPrice != null) params.set("minPrice", String(minPrice));
    if (maxPrice != null) params.set("maxPrice", String(maxPrice));
    if (minRating != null) params.set("minRating", String(minRating));
    formats.forEach((f) => params.append("format", f));
    if (availableThisWeek) params.set("availableThisWeek", "1");
    if (sort !== "relevance") params.set("sort", sort);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/results?${params.toString()}`;
  }

  return (
    <main>
      <div className="wrap results-top">
        <span className="eyebrow">
          {total} teacher{total === 1 ? "" : "s"} found
        </span>
        <form action="/results" method="get" className="results-search">
          <select name="instrument" defaultValue={instrument}>
            <option value="">Any instrument</option>
            {instruments.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <input name="location" defaultValue={location} placeholder="Edinburgh, or Online" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      <div className="wrap results-body">
        <aside className="filters">
          <form action="/results" method="get">
            <input type="hidden" name="instrument" value={instrument} />
            <input type="hidden" name="location" value={location} />

            <div className="filter-group">
              <h4>Format</h4>
              <label className="chip-check">
                <input type="checkbox" name="format" value="ONLINE" defaultChecked={formats.includes("ONLINE")} />
                <span>Online</span>
              </label>
              <label className="chip-check">
                <input
                  type="checkbox"
                  name="format"
                  value="IN_PERSON"
                  defaultChecked={formats.includes("IN_PERSON")}
                />
                <span>In person</span>
              </label>
            </div>

            <div className="filter-group">
              <h4>Price / hour (£)</h4>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  name="minPrice"
                  min="0"
                  placeholder="Min"
                  defaultValue={minPrice ?? ""}
                  style={{ width: "50%" }}
                />
                <input
                  type="number"
                  name="maxPrice"
                  min="0"
                  placeholder="Max"
                  defaultValue={maxPrice ?? ""}
                  style={{ width: "50%" }}
                />
              </div>
            </div>

            <div className="filter-group">
              <h4>Rating</h4>
              <label className="chip-check">
                <input type="radio" name="minRating" value="" defaultChecked={minRating == null} />
                <span>Any</span>
              </label>
              <label className="chip-check">
                <input type="radio" name="minRating" value="3.5" defaultChecked={minRating === 3.5} />
                <span>3.5+</span>
              </label>
              <label className="chip-check">
                <input type="radio" name="minRating" value="4" defaultChecked={minRating === 4} />
                <span>4.0+</span>
              </label>
              <label className="chip-check">
                <input type="radio" name="minRating" value="4.5" defaultChecked={minRating === 4.5} />
                <span>4.5+</span>
              </label>
            </div>

            <div className="filter-group">
              <h4>Availability</h4>
              <label className="chip-check">
                <input type="checkbox" name="availableThisWeek" value="1" defaultChecked={availableThisWeek} />
                <span>Available this week</span>
              </label>
            </div>

            <div className="filter-group">
              <h4>Sort</h4>
              <select name="sort" defaultValue={sort}>
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="rating">Rating</option>
                <option value="soonest">Soonest available</option>
              </select>
            </div>

            <button type="submit" className="btn btn-secondary" style={{ width: "100%" }}>
              Apply filters
            </button>
          </form>
        </aside>

        <div>
          {teachers.length === 0 ? (
            <div className="empty-state">
              <p>No teachers match — try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="results-list-head">
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
              </div>
              <div className="rlist">
                {teachers.map((t) => (
                  <Link key={t.id} href={`/teachers/${t.id}`} className="rcard">
                    <div className="photo">
                      {t.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- teacher-submitted URL, any host
                        <img src={t.photoUrl} alt={t.user.fullName} />
                      ) : (
                        initials(t.user.fullName)
                      )}
                    </div>
                    <div>
                      <div className="name">{t.user.fullName}</div>
                      <div className="desc">{t.bio}</div>
                      <div className="tag-row">
                        {t.formatsOffered.map((f) => (
                          <span key={f} className="badge">
                            {f === "ONLINE" ? "Online" : "In person"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="side">
                      <div className="note-rating">
                        ♪♪♪♪♪ {Number(t.avgRating).toFixed(1)} ({t.reviewCount})
                      </div>
                      <div className="price">£{(t.hourlyRateMinorUnits / 100).toFixed(0)}/hr</div>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="btn btn-ghost">
                      ← Prev
                    </Link>
                  ) : (
                    <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
                      ← Prev
                    </span>
                  )}
                  <span className="t-soft">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)} className="btn btn-ghost">
                      Next →
                    </Link>
                  ) : (
                    <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
                      Next →
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
