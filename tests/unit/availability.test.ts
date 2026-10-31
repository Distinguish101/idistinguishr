import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rules, exceptions } = vi.hoisted(() => ({ rules: vi.fn(), exceptions: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { availabilityRule: { findMany: rules }, availabilityException: { findMany: exceptions } },
}));

import { getUpcomingAvailability } from "@/lib/availability";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rule = (dayOfWeek: number, startTime: string, endTime: string) => ({ dayOfWeek, startTime, endTime });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T10:30:00Z")); // a Wednesday
  rules.mockResolvedValue([]);
  exceptions.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("getUpcomingAvailability (coarse windows for previews and filters)", () => {
  it("is empty with no rules", async () => {
    expect(await getUpcomingAvailability("t1")).toEqual([]);
  });

  it("lists each matching weekday in the next 14 days, whole windows, in date order", async () => {
    rules.mockResolvedValue([rule(4, "09:00", "12:00"), rule(1, "17:00", "19:00")]);
    const windows = await getUpcomingAvailability("t1");
    expect(windows).toEqual([
      { date: "2026-11-05", startTime: "09:00", endTime: "12:00" },
      { date: "2026-11-09", startTime: "17:00", endTime: "19:00" },
      { date: "2026-11-12", startTime: "09:00", endTime: "12:00" },
      { date: "2026-11-16", startTime: "17:00", endTime: "19:00" },
    ]);
  });

  it("includes today, because a day's windows are not trimmed to the current time", async () => {
    rules.mockResolvedValue([rule(3, "09:00", "10:00")]);
    expect((await getUpcomingAvailability("t1", 1)).map((w) => w.date)).toEqual(["2026-11-04"]);
  });

  it("respects the number of days asked for", async () => {
    rules.mockResolvedValue([rule(4, "09:00", "10:00")]);
    expect(await getUpcomingAvailability("t1", 1)).toEqual([]);
    expect(await getUpcomingAvailability("t1", 3)).toHaveLength(1);
  });

  it("removes a whole day for an all-day BLOCKED exception", async () => {
    rules.mockResolvedValue([rule(4, "09:00", "12:00")]);
    exceptions.mockResolvedValue([{ date: d("2026-11-05"), type: "BLOCKED", startTime: null, endTime: null }]);
    expect((await getUpcomingAvailability("t1")).map((w) => w.date)).toEqual(["2026-11-12"]);
  });

  it("drops a whole window that a timed BLOCKED overlaps (it does not split it)", async () => {
    rules.mockResolvedValue([rule(4, "09:00", "12:00")]);
    exceptions.mockResolvedValue([{ date: d("2026-11-05"), type: "BLOCKED", startTime: "11:00", endTime: "11:30" }]);
    expect((await getUpcomingAvailability("t1")).map((w) => w.date)).toEqual(["2026-11-12"]);
  });

  it("keeps a window that a timed BLOCKED only touches at the edge", async () => {
    rules.mockResolvedValue([rule(4, "09:00", "12:00")]);
    exceptions.mockResolvedValue([{ date: d("2026-11-05"), type: "BLOCKED", startTime: "12:00", endTime: "13:00" }]);
    expect((await getUpcomingAvailability("t1")).map((w) => w.date)).toEqual(["2026-11-05", "2026-11-12"]);
  });

  it("adds an extra window for an ADDED exception", async () => {
    exceptions.mockResolvedValue([{ date: d("2026-11-07"), type: "ADDED", startTime: "14:00", endTime: "16:00" }]);
    expect(await getUpcomingAvailability("t1")).toEqual([{ date: "2026-11-07", startTime: "14:00", endTime: "16:00" }]);
  });

  it("asks the database only for this teacher's rules and the date range's exceptions", async () => {
    await getUpcomingAvailability("teacher-9", 14);
    expect(rules).toHaveBeenCalledWith({ where: { teacherId: "teacher-9" } });
    const where = exceptions.mock.calls[0][0].where;
    expect(where.teacherId).toBe("teacher-9");
    expect(where.date.gte).toEqual(d("2026-11-04"));
    expect(where.date.lte).toEqual(d("2026-11-18"));
  });
});
