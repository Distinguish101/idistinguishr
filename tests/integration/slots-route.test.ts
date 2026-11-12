import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/teachers/[id]/slots/route";
import { daysFromToday, nextWeekday } from "../helpers/dates";
import { addException, addRule, createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, params, readJson } from "../helpers/http";

const WEEKDAY = 4;
let teacher: Awaited<ReturnType<typeof createInstructor>>;

const getSlots = (id: string, query = "") => GET(jsonRequest(`/api/teachers/${id}/slots${query}`, "GET"), params({ id }));
const slotsFor = async (date: string, query = "") => {
  const body = await readJson(await getSlots(teacher.profile.id, query));
  return (body.slots as { date: string; startTime: string; endTime: string }[]).filter((s) => s.date === date);
};

beforeEach(async () => {
  await resetDb();
  teacher = await createInstructor();
  await addRule(teacher.profile.id, WEEKDAY, "09:00", "12:00");
});

describe("GET /api/teachers/[id]/slots", () => {
  it("lists bookable hour-long slots by default", async () => {
    const date = nextWeekday(WEEKDAY);
    expect(await slotsFor(date)).toEqual([
      { date, startTime: "09:00", endTime: "10:00" },
      { date, startTime: "10:00", endTime: "11:00" },
      { date, startTime: "11:00", endTime: "12:00" },
    ]);
  });

  it.each([
    [30, 6],
    [45, 4],
    [60, 3],
  ])("supports %i-minute lessons (%i slots in a 3-hour window)", async (minutes, count) => {
    expect(await slotsFor(nextWeekday(WEEKDAY), `?duration=${minutes}`)).toHaveLength(count);
  });

  it.each(["20", "0", "-30", "abc", "90", "60.5"])("400 for duration=%s", async (duration) => {
    const res = await getSlots(teacher.profile.id, `?duration=${duration}`);
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe("Invalid duration");
  });

  it("covers the next 14 days, repeating each week", async () => {
    const body = await readJson(await getSlots(teacher.profile.id));
    const dates = [...new Set((body.slots as { date: string }[]).map((s) => s.date))].sort();
    // A weekly rule falls on 2 days in a 14-day window. If today is that
    // weekday and the slots have already passed, only the later one is left,
    // so the count depends on when the test runs: 1 or 2, never more.
    expect(dates.length).toBeGreaterThanOrEqual(1);
    expect(dates.length).toBeLessThanOrEqual(2);
    expect(dates.every((d) => d >= daysFromToday(0) && d <= daysFromToday(13))).toBe(true);
    expect(dates.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === WEEKDAY)).toBe(true);
    if (dates.length === 2) {
      const gapDays = (Date.parse(dates[1]) - Date.parse(dates[0])) / 86_400_000;
      expect(gapDays).toBe(7);
    }
  });

  it("leaves out booked, blocked and extra time correctly", async () => {
    const date = nextWeekday(WEEKDAY);
    const student = await createStudent();
    await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, startTime: "10:00" });
    expect((await slotsFor(date)).map((s) => s.startTime)).toEqual(["09:00", "11:00"]);

    await addException(teacher.profile.id, { date, type: "BLOCKED", startTime: "09:00", endTime: "10:00" });
    expect((await slotsFor(date)).map((s) => s.startTime)).toEqual(["11:00"]);

    await addException(teacher.profile.id, { date, type: "ADDED", startTime: "14:00", endTime: "15:00" });
    expect((await slotsFor(date)).map((s) => s.startTime)).toEqual(["11:00", "14:00"]);
  });

  it("returns an empty list for an instructor with no availability", async () => {
    const empty = await createInstructor();
    const res = await getSlots(empty.profile.id);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ slots: [] });
  });

  it("404 for an unknown instructor", async () => {
    expect((await getSlots("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it.each([
    ["pending approval", { approvalStatus: "PENDING" as const }],
    ["rejected", { approvalStatus: "REJECTED" as const }],
    ["without payout setup", { stripeOnboardingComplete: false }],
  ])("404 for an instructor who is %s", async (_label, patch) => {
    const t = await createInstructor(patch);
    await addRule(t.profile.id, WEEKDAY, "09:00", "12:00");
    expect((await getSlots(t.profile.id)).status).toBe(404);
  });

  it.each(["DEACTIVATED", "SUSPENDED", "DELETED"] as const)("404 for an instructor whose account is %s", async (status) => {
    const t = await createInstructor({ user: { status } });
    await addRule(t.profile.id, WEEKDAY, "09:00", "12:00");
    expect((await getSlots(t.profile.id)).status).toBe(404);
  });
});
