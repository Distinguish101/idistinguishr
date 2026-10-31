import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rules, exceptions, bookings } = vi.hoisted(() => ({
  rules: vi.fn(),
  exceptions: vi.fn(),
  bookings: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    availabilityRule: { findMany: rules },
    availabilityException: { findMany: exceptions },
    booking: { findMany: bookings },
  },
}));

import { getBookableSlots, HOLD_EXPIRY_MINUTES } from "@/lib/booking-slots";

// Wednesday 4 Nov 2026, 10:30 UTC. In winter the UK is on GMT, so UK time is 10:30 too.
const WED_WINTER = "2026-11-04T10:30:00Z";
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rule = (dayOfWeek: number, startTime: string, endTime: string) => ({ dayOfWeek, startTime, endTime });

function setup(o: { rules?: any[]; exceptions?: any[]; bookings?: any[] } = {}) {
  rules.mockResolvedValue(o.rules ?? []);
  exceptions.mockResolvedValue(o.exceptions ?? []);
  bookings.mockResolvedValue(o.bookings ?? []);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(WED_WINTER));
});
afterEach(() => vi.useRealTimers());

describe("getBookableSlots", () => {
  it("is empty with no weekly availability", async () => {
    setup();
    expect(await getBookableSlots("t1", 60)).toEqual([]);
  });

  it("cuts each weekly window into lessons of the chosen length", async () => {
    setup({ rules: [rule(4, "09:00", "12:00")] }); // Thursdays
    const slots = await getBookableSlots("t1", 60);
    expect(slots.filter((s) => s.date === "2026-11-05")).toEqual([
      { date: "2026-11-05", startTime: "09:00", endTime: "10:00" },
      { date: "2026-11-05", startTime: "10:00", endTime: "11:00" },
      { date: "2026-11-05", startTime: "11:00", endTime: "12:00" },
    ]);
  });

  it("repeats weekly across the 14-day window, and sorts the result", async () => {
    setup({ rules: [rule(4, "11:00", "12:00"), rule(1, "09:00", "10:00")] });
    const slots = await getBookableSlots("t1", 60);
    expect(slots.map((s) => `${s.date} ${s.startTime}`)).toEqual([
      "2026-11-05 11:00", // Thu
      "2026-11-09 09:00", // Mon
      "2026-11-12 11:00", // Thu
      "2026-11-16 09:00", // Mon
    ]);
  });

  it("limits the look-ahead to the days asked for", async () => {
    setup({ rules: [rule(4, "09:00", "10:00")] });
    expect(await getBookableSlots("t1", 60, 1)).toEqual([]); // only today (Wed)
    expect((await getBookableSlots("t1", 60, 3)).map((s) => s.date)).toEqual(["2026-11-05"]);
  });

  it("drops a window too short for the lesson length", async () => {
    setup({ rules: [rule(4, "09:00", "09:45")] });
    expect(await getBookableSlots("t1", 60)).toEqual([]);
    expect((await getBookableSlots("t1", 30)).filter((s) => s.date === "2026-11-05")).toHaveLength(1);
  });

  it("ignores a window left over that does not divide evenly", async () => {
    setup({ rules: [rule(4, "09:00", "10:45")] });
    const slots = (await getBookableSlots("t1", 60)).filter((s) => s.date === "2026-11-05");
    expect(slots.map((s) => s.startTime)).toEqual(["09:00"]);
  });

  describe("exceptions", () => {
    it("a whole-day BLOCKED removes that day", async () => {
      setup({
        rules: [rule(4, "09:00", "10:00")],
        exceptions: [{ date: d("2026-11-05"), type: "BLOCKED", startTime: null, endTime: null }],
      });
      expect((await getBookableSlots("t1", 60)).map((s) => s.date)).toEqual(["2026-11-12"]);
    });

    it("a timed BLOCKED carves a hole in the middle of a window", async () => {
      setup({
        rules: [rule(4, "09:00", "12:00")],
        exceptions: [{ date: d("2026-11-05"), type: "BLOCKED", startTime: "10:00", endTime: "11:00" }],
      });
      const times = (await getBookableSlots("t1", 30))
        .filter((s) => s.date === "2026-11-05")
        .map((s) => s.startTime);
      expect(times).toEqual(["09:00", "09:30", "11:00", "11:30"]);
    });

    it("ADDED opens an extra window on a day with no weekly rule", async () => {
      setup({ exceptions: [{ date: d("2026-11-07"), type: "ADDED", startTime: "14:00", endTime: "16:00" }] });
      const slots = await getBookableSlots("t1", 60);
      expect(slots.map((s) => `${s.date} ${s.startTime}`)).toEqual(["2026-11-07 14:00", "2026-11-07 15:00"]);
    });

    it("an ADDED window can itself be blocked", async () => {
      setup({
        exceptions: [
          { date: d("2026-11-07"), type: "ADDED", startTime: "14:00", endTime: "16:00" },
          { date: d("2026-11-07"), type: "BLOCKED", startTime: "14:00", endTime: "15:00" },
        ],
      });
      expect((await getBookableSlots("t1", 60)).map((s) => s.startTime)).toEqual(["15:00"]);
    });

    it("an ADDED exception without times adds nothing", async () => {
      setup({ exceptions: [{ date: d("2026-11-07"), type: "ADDED", startTime: null, endTime: null }] });
      expect(await getBookableSlots("t1", 60)).toEqual([]);
    });
  });

  describe("existing bookings", () => {
    it("remove the time they occupy, leaving the rest bookable", async () => {
      setup({
        rules: [rule(4, "09:00", "12:00")],
        bookings: [{ lessonDate: d("2026-11-05"), startTime: "10:00", durationMinutes: 60 }],
      });
      const times = (await getBookableSlots("t1", 60)).filter((s) => s.date === "2026-11-05").map((s) => s.startTime);
      expect(times).toEqual(["09:00", "11:00"]);
    });

    it("block overlapping shorter slots too (a 90-minute lesson blocks 3 half-hours)", async () => {
      setup({
        rules: [rule(4, "09:00", "12:00")],
        bookings: [{ lessonDate: d("2026-11-05"), startTime: "09:30", durationMinutes: 90 }],
      });
      const times = (await getBookableSlots("t1", 30)).filter((s) => s.date === "2026-11-05").map((s) => s.startTime);
      expect(times).toEqual(["09:00", "11:00", "11:30"]);
    });

    it("only affect their own date", async () => {
      setup({
        rules: [rule(4, "09:00", "10:00")],
        bookings: [{ lessonDate: d("2026-11-05"), startTime: "09:00", durationMinutes: 60 }],
      });
      expect((await getBookableSlots("t1", 60)).map((s) => s.date)).toEqual(["2026-11-12"]);
    });

    it("count confirmed/completed lessons, and pending ones only while the 10-minute hold lasts", async () => {
      setup();
      await getBookableSlots("t1", 60);
      const where = bookings.mock.calls[0][0].where;
      expect(where.teacherId).toBe("t1");
      expect(where.OR[0]).toEqual({ status: { in: ["CONFIRMED", "COMPLETED"] } });
      expect(where.OR[1].status).toBe("PENDING_PAYMENT");
      const cutoff: Date = where.OR[1].createdAt.gte;
      expect(new Date(WED_WINTER).getTime() - cutoff.getTime()).toBe(HOLD_EXPIRY_MINUTES * 60_000);
      expect(HOLD_EXPIRY_MINUTES).toBe(10);
    });
  });

  describe("today's past slots (UK wall-clock time)", () => {
    it("drops today's slots that have started, keeps later ones", async () => {
      setup({ rules: [rule(3, "09:00", "13:00")] }); // today is Wednesday, UK time 10:30
      const today = (await getBookableSlots("t1", 60, 1)).map((s) => s.startTime);
      expect(today).toEqual(["11:00", "12:00"]);
    });

    it("drops a slot starting exactly now", async () => {
      vi.setSystemTime(new Date("2026-11-04T11:00:00Z"));
      setup({ rules: [rule(3, "10:00", "13:00")] });
      expect((await getBookableSlots("t1", 60, 1)).map((s) => s.startTime)).toEqual(["12:00"]);
    });

    it("uses UK time in summer (BST = UTC+1), not the server's clock", async () => {
      vi.setSystemTime(new Date("2026-07-01T11:30:00Z")); // 12:30 in the UK
      setup({ rules: [rule(3, "11:00", "15:00")] });
      expect((await getBookableSlots("t1", 60, 1)).map((s) => s.startTime)).toEqual(["13:00", "14:00"]);
    });

    it("keeps all of tomorrow's slots", async () => {
      vi.setSystemTime(new Date("2026-11-04T23:00:00Z"));
      setup({ rules: [rule(4, "00:00", "02:00")] });
      expect((await getBookableSlots("t1", 60, 2)).map((s) => `${s.date} ${s.startTime}`)).toEqual([
        "2026-11-05 00:00",
        "2026-11-05 01:00",
      ]);
    });
  });
});
