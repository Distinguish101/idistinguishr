import { beforeEach, describe, expect, it } from "vitest";
import { getFeaturedTeachers, getInstrumentOptions, searchTeachers } from "@/lib/teacher-search";
import { prisma } from "@/lib/prisma";
import { daysFromToday, dayOfWeekOf } from "../helpers/dates";
import { addException, addRule, createInstructor, resetDb } from "../helpers/factories";

type Opts = Parameters<typeof createInstructor>[0];
const names = (r: Awaited<ReturnType<typeof searchTeachers>>) => r.teachers.map((t) => t.user.fullName);
const make = (fullName: string, o: Opts = {}) => createInstructor({ ...o, user: { ...o?.user, fullName } });

beforeEach(resetDb);

describe("searchTeachers: who is listed", () => {
  it("lists only approved, payout-ready instructors with an active account", async () => {
    await make("Visible");
    await make("Pending", { approvalStatus: "PENDING" });
    await make("Rejected", { approvalStatus: "REJECTED" });
    await make("No payouts", { stripeOnboardingComplete: false });
    await make("Deactivated", { user: { status: "DEACTIVATED" } });
    await make("Suspended", { user: { status: "SUSPENDED" } });
    await make("Deleted", { user: { status: "DELETED" } });
    const result = await searchTeachers({});
    expect(names(result)).toEqual(["Visible"]);
    expect(result.total).toBe(1);
  });

  it("returns an empty result with no instructors", async () => {
    expect(await searchTeachers({})).toMatchObject({ teachers: [], total: 0, page: 1, pageSize: 12 });
  });
});

describe("searchTeachers: filters", () => {
  it("instrument: matches whatever the capitalisation, including older capitalised rows", async () => {
    await make("Pia", { instruments: ["piano"] });
    await make("Gui", { instruments: ["guitar", "voice"] });
    await make("Legacy", { instruments: ["Violin"] }); // saved before names were normalised
    expect(names(await searchTeachers({ instrument: "Piano" }))).toEqual(["Pia"]);
    expect(names(await searchTeachers({ instrument: "  VOICE " }))).toEqual(["Gui"]);
    expect(names(await searchTeachers({ instrument: "violin" }))).toEqual(["Legacy"]);
    expect(names(await searchTeachers({ instrument: "bagpipes" }))).toEqual([]);
  });

  it("price: inclusive range in pounds", async () => {
    await make("Cheap", { hourlyRateMinorUnits: 2000 });
    await make("Mid", { hourlyRateMinorUnits: 4000 });
    await make("Pricey", { hourlyRateMinorUnits: 8000 });
    expect((await searchTeachers({ minPrice: 30 })).total).toBe(2);
    expect(names(await searchTeachers({ maxPrice: 40, sort: "price_asc" }))).toEqual(["Cheap", "Mid"]);
    expect(names(await searchTeachers({ minPrice: 40, maxPrice: 40 }))).toEqual(["Mid"]);
    expect(names(await searchTeachers({ minPrice: 100 }))).toEqual([]);
  });

  it("rating: minimum average", async () => {
    await make("Great", { avgRating: 4.8, reviewCount: 5 });
    await make("Okay", { avgRating: 3.5, reviewCount: 5 });
    expect(names(await searchTeachers({ minRating: 4 }))).toEqual(["Great"]);
    expect(names(await searchTeachers({ minRating: 3.5, sort: "rating" }))).toEqual(["Great", "Okay"]);
  });

  it("formats: any of the chosen formats", async () => {
    await make("Online", { formatsOffered: ["ONLINE"] });
    await make("Both", { formatsOffered: ["ONLINE", "IN_PERSON"], locationText: "Leeds" });
    await make("InPerson", { formatsOffered: ["IN_PERSON"], locationText: "York" });
    expect((await searchTeachers({ formats: ["IN_PERSON"] })).total).toBe(2);
    expect((await searchTeachers({ formats: ["ONLINE"] })).total).toBe(2);
    expect((await searchTeachers({ formats: ["ONLINE", "IN_PERSON"] })).total).toBe(3);
  });

  it("location: 'online' means online lessons; anything else matches the place, ignoring case", async () => {
    await make("Online", { formatsOffered: ["ONLINE"] });
    await make("Leeds", { formatsOffered: ["IN_PERSON"], locationText: "Headingley, Leeds" });
    await make("York", { formatsOffered: ["IN_PERSON"], locationText: "York" });
    expect(names(await searchTeachers({ location: "Online" }))).toEqual(["Online"]);
    expect(names(await searchTeachers({ location: "leeds" }))).toEqual(["Leeds"]);
    expect(names(await searchTeachers({ location: "  HEADINGLEY " }))).toEqual(["Leeds"]);
    expect(names(await searchTeachers({ location: "Bristol" }))).toEqual([]);
  });

  it("combines filters", async () => {
    await make("Match", { instruments: ["piano"], hourlyRateMinorUnits: 3000, avgRating: 4.5 });
    await make("WrongInstrument", { instruments: ["drums"], hourlyRateMinorUnits: 3000, avgRating: 4.5 });
    await make("TooPricey", { instruments: ["piano"], hourlyRateMinorUnits: 9000, avgRating: 4.5 });
    await make("LowRated", { instruments: ["piano"], hourlyRateMinorUnits: 3000, avgRating: 2 });
    expect(names(await searchTeachers({ instrument: "piano", maxPrice: 50, minRating: 4 }))).toEqual(["Match"]);
  });
});

describe("searchTeachers: order and pages", () => {
  beforeEach(async () => {
    await make("B", { hourlyRateMinorUnits: 3000, avgRating: 4.0, reviewCount: 10 });
    await make("A", { hourlyRateMinorUnits: 5000, avgRating: 4.9, reviewCount: 3 });
    await make("C", { hourlyRateMinorUnits: 2000, avgRating: 4.0, reviewCount: 20 });
  });

  it("default and 'rating': best rated first, then most reviewed", async () => {
    expect(names(await searchTeachers({}))).toEqual(["A", "C", "B"]);
    expect(names(await searchTeachers({ sort: "rating" }))).toEqual(["A", "C", "B"]);
  });

  it("price ascending and descending", async () => {
    expect(names(await searchTeachers({ sort: "price_asc" }))).toEqual(["C", "B", "A"]);
    expect(names(await searchTeachers({ sort: "price_desc" }))).toEqual(["A", "B", "C"]);
  });

  it("pages of 12, with the total across all pages", async () => {
    for (let i = 0; i < 12; i++) await make(`Extra ${i}`, { hourlyRateMinorUnits: 6000 + i, avgRating: 1 });
    const first = await searchTeachers({ sort: "price_asc" });
    const second = await searchTeachers({ sort: "price_asc", page: 2 });
    expect(first.total).toBe(15);
    expect(first.teachers).toHaveLength(12);
    expect(second.teachers).toHaveLength(3);
    expect(second.page).toBe(2);
    expect(new Set([...names(first), ...names(second)]).size).toBe(15);
  });

  it("treats a missing, zero or negative page as page 1", async () => {
    expect((await searchTeachers({ page: 0 })).page).toBe(1);
    expect((await searchTeachers({ page: -3 })).page).toBe(1);
  });

  it("a page past the end is empty", async () => {
    const r = await searchTeachers({ page: 5 });
    expect(r.teachers).toEqual([]);
    expect(r.total).toBe(3);
  });
});

describe("searchTeachers: availability", () => {
  const todayDow = dayOfWeekOf(daysFromToday(0));
  const dow = (daysAhead: number) => dayOfWeekOf(daysFromToday(daysAhead));

  it("'available this week' keeps only instructors with a window in the next 7 days", async () => {
    const free = await make("Free");
    await make("Never free");
    await addRule(free.profile.id, dow(2), "09:00", "10:00");
    expect(names(await searchTeachers({ availableThisWeek: true }))).toEqual(["Free"]);
  });

  it("is not fooled by a rule that is blocked on its only day this week", async () => {
    const t = await make("Blocked");
    await addRule(t.profile.id, dow(3), "09:00", "10:00");
    await addException(t.profile.id, { date: daysFromToday(3), type: "BLOCKED" });
    expect(names(await searchTeachers({ availableThisWeek: true }))).toEqual([]);
  });

  it("a one-off added day counts as availability", async () => {
    const t = await make("Extra day");
    await addException(t.profile.id, { date: daysFromToday(2), type: "ADDED", startTime: "10:00", endTime: "11:00" });
    expect(names(await searchTeachers({ availableThisWeek: true }))).toEqual(["Extra day"]);
  });

  it("'soonest' orders by the earliest open day and drops instructors with none", async () => {
    const later = await make("Later");
    const sooner = await make("Sooner");
    await make("None");
    await addRule(later.profile.id, dow(5), "09:00", "10:00");
    await addRule(sooner.profile.id, dow(1), "09:00", "10:00");
    const result = await searchTeachers({ sort: "soonest" });
    expect(names(result)).toEqual(["Sooner", "Later"]);
    expect(result.total).toBe(2);
  });

  it("includes today when the instructor works today's weekday", async () => {
    const today = await make("Today");
    const tomorrow = await make("Tomorrow");
    await addRule(tomorrow.profile.id, dow(1), "09:00", "10:00");
    await addRule(today.profile.id, todayDow, "09:00", "10:00");
    expect(names(await searchTeachers({ sort: "soonest" }))).toEqual(["Today", "Tomorrow"]);
  });

  it("combines with the other filters", async () => {
    const a = await make("Piano free", { instruments: ["piano"] });
    const b = await make("Drums free", { instruments: ["drums"] });
    await addRule(a.profile.id, dow(2), "09:00", "10:00");
    await addRule(b.profile.id, dow(2), "09:00", "10:00");
    expect(names(await searchTeachers({ instrument: "piano", availableThisWeek: true }))).toEqual(["Piano free"]);
  });

  it("paginates the availability-filtered list", async () => {
    for (let i = 0; i < 14; i++) {
      const t = await make(`T${i}`, { avgRating: 5 - i / 10 });
      await addRule(t.profile.id, dow(2), "09:00", "10:00");
    }
    const p1 = await searchTeachers({ availableThisWeek: true });
    const p2 = await searchTeachers({ availableThisWeek: true, page: 2 });
    expect(p1.total).toBe(14);
    expect(p1.teachers).toHaveLength(12);
    expect(p2.teachers).toHaveLength(2);
  });
});

describe("getInstrumentOptions", () => {
  it("lists each instrument of bookable instructors once, normalised and sorted", async () => {
    await make("A", { instruments: ["Piano", "violin"] });
    await make("B", { instruments: ["piano", "Electric  Guitar"] });
    await make("Hidden", { instruments: ["tuba"], approvalStatus: "PENDING" });
    await make("Gone", { instruments: ["harp"], user: { status: "DELETED" } });
    expect(await getInstrumentOptions()).toEqual(["electric guitar", "piano", "violin"]);
  });

  it("is empty when nobody is bookable", async () => {
    expect(await getInstrumentOptions()).toEqual([]);
  });
});

describe("getFeaturedTeachers", () => {
  it("returns the top-rated bookable instructors, three by default", async () => {
    await make("Low", { avgRating: 3.0 });
    await make("High", { avgRating: 4.9 });
    await make("Mid", { avgRating: 4.2 });
    await make("Higher", { avgRating: 4.95 });
    await make("Hidden", { avgRating: 5, approvalStatus: "PENDING" });
    expect((await getFeaturedTeachers()).map((t) => t.user.fullName)).toEqual(["Higher", "High", "Mid"]);
    expect(await getFeaturedTeachers(1)).toHaveLength(1);
    expect(await getFeaturedTeachers(10)).toHaveLength(4);
  });

  it("breaks rating ties by number of reviews", async () => {
    await make("Few", { avgRating: 4.5, reviewCount: 2 });
    await make("Many", { avgRating: 4.5, reviewCount: 40 });
    expect((await getFeaturedTeachers(2)).map((t) => t.user.fullName)).toEqual(["Many", "Few"]);
  });
});

describe("database sanity", () => {
  it("starts every test with an empty database", async () => {
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.teacherProfile.count()).toBe(0);
  });
});
