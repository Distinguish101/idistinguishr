import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { POST } from "@/app/api/bookings/[id]/cancel/route";
import { getBookableSlots } from "@/lib/booking-slots";
import { prisma } from "@/lib/prisma";
import { signInAs, signOut } from "../helpers/auth-mock";
import { daysFromToday } from "../helpers/dates";
import { addRule, createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, params, readJson } from "../helpers/http";

let student: Awaited<ReturnType<typeof createStudent>>;
let teacher: Awaited<ReturnType<typeof createInstructor>>;

const cancel = (id: string) => POST(jsonRequest(`/api/bookings/${id}/cancel`, "POST"), params({ id }));
const booking = (o: Partial<Parameters<typeof createBooking>[0]> = {}) =>
  createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: daysFromToday(10), startTime: "10:00", ...o });

beforeEach(async () => {
  await resetDb();
  student = await createStudent();
  teacher = await createInstructor();
  signInAs({ id: student.id, role: "STUDENT" });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/bookings/[id]/cancel", () => {
  it("cancels a confirmed lesson that is well ahead, recording who and when", async () => {
    const b = await booking();
    const res = await cancel(b.id);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.cancelledBy).toBe("STUDENT");
    expect(saved.cancelledAt).not.toBeNull();
  });

  it("frees the slot for other students", async () => {
    const weekday = new Date(`${daysFromToday(10)}T00:00:00Z`).getUTCDay();
    await addRule(teacher.profile.id, weekday, "09:00", "12:00");
    // 10 days ahead is outside nothing: it is inside the 14-day window.
    const b = await booking({ startTime: "10:00" });
    const before = await getBookableSlots(teacher.profile.id, 60);
    expect(before.some((s) => s.date === daysFromToday(10) && s.startTime === "10:00")).toBe(false);

    await cancel(b.id);
    const after = await getBookableSlots(teacher.profile.id, 60);
    expect(after.some((s) => s.date === daysFromToday(10) && s.startTime === "10:00")).toBe(true);
  });

  it("is refused without a session, or for an instructor account", async () => {
    const b = await booking();
    signOut();
    expect((await cancel(b.id)).status).toBe(401);
    signInAs({ id: teacher.user.id, role: "TEACHER" });
    expect((await cancel(b.id)).status).toBe(401);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });

  it("404 for someone else's booking, and for an id that does not exist", async () => {
    const other = await createStudent();
    const b = await createBooking({ studentId: other.id, teacherId: teacher.profile.id, date: daysFromToday(10) });
    expect((await cancel(b.id)).status).toBe(404);
    expect((await cancel("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });

  it.each(["PENDING_PAYMENT", "COMPLETED", "CANCELLED"] as const)("only confirmed lessons can be cancelled (%s is refused)", async (status) => {
    const b = await booking({ status });
    const res = await cancel(b.id);
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/Only confirmed/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(status);
  });

  describe("the 48-hour window", () => {
    // Fix the clock so the boundary can be tested to the second.
    // Lesson: Fri 6 Nov 2026 10:00. Cut-off: Wed 4 Nov 2026 10:00.
    const lesson = { date: "2026-11-06", startTime: "10:00" };

    it("refuses inside the window", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-05T10:00:00Z")); // 24h before
      const b = await booking(lesson);
      const res = await cancel(b.id);
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toMatch(/48 hours/);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
    });

    it("allows one second before the cut-off", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-04T09:59:59Z"));
      const b = await booking(lesson);
      expect((await cancel(b.id)).status).toBe(200);
    });

    it("refuses exactly at the cut-off", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
      const b = await booking(lesson);
      expect((await cancel(b.id)).status).toBe(400);
    });

    it("refuses a lesson that has already started", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-06T11:00:00Z"));
      const b = await booking(lesson);
      expect((await cancel(b.id)).status).toBe(400);
    });

    it("uses the window saved on the booking, not the current policy", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-05T09:00:00Z")); // 25h before: inside 48h, outside 24h
      const strict = await booking(lesson);
      expect((await cancel(strict.id)).status).toBe(400);

      const relaxed = await booking({ ...lesson, startTime: "11:00" });
      await prisma.booking.update({ where: { id: relaxed.id }, data: { cancellationWindowHours: 24 } });
      expect((await cancel(relaxed.id)).status).toBe(200);
    });
  });
});
