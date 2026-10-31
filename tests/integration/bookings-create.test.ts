import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { POST } from "@/app/api/bookings/route";
import { prisma } from "@/lib/prisma";
import { signInAs, signOut } from "../helpers/auth-mock";
import { daysFromToday, nextWeekday, dayOfWeekOf, utcMidnight } from "../helpers/dates";
import { addException, addRule, createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, readJson } from "../helpers/http";

// A teacher free on one weekday, 09:00-12:00, and a date on that weekday this week or next.
const WEEKDAY = 4; // Thursday
let date: string;
let student: Awaited<ReturnType<typeof createStudent>>;
let teacher: Awaited<ReturnType<typeof createInstructor>>;

const book = (body: Record<string, unknown> = {}) =>
  POST(
    jsonRequest("/api/bookings", "POST", {
      teacherId: teacher.profile.id,
      date,
      startTime: "10:00",
      durationMinutes: 60,
      format: "ONLINE",
      ...body,
    })
  );

beforeEach(async () => {
  await resetDb();
  date = nextWeekday(WEEKDAY);
  student = await createStudent();
  teacher = await createInstructor({ hourlyRateMinorUnits: 4500, formatsOffered: ["ONLINE", "IN_PERSON"] });
  await addRule(teacher.profile.id, WEEKDAY, "09:00", "12:00");
  signInAs({ id: student.id, role: "STUDENT" });
});

describe("POST /api/bookings: who can book", () => {
  it("needs a signed-in user", async () => {
    signOut();
    const res = await book();
    expect(res.status).toBe(401);
    expect(await prisma.booking.count()).toBe(0);
  });

  it("is for students only", async () => {
    signInAs({ id: teacher.user.id, role: "TEACHER" });
    const res = await book();
    expect(res.status).toBe(403);
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe("POST /api/bookings: validation", () => {
  it.each([
    ["a teacherId that is not a UUID", { teacherId: "abc" }],
    ["a missing teacherId", { teacherId: undefined }],
    ["a date in the wrong format", { date: "05/11/2026" }],
    ["a start time that is not HH:mm", { startTime: "9:00" }],
    ["a start time past 23:59", { startTime: "24:00" }],
    ["a duration that is not offered", { durationMinutes: 20 }],
    ["a duration sent as text", { durationMinutes: "60" }],
    ["an unknown format", { format: "TELEPATHY" }],
  ])("rejects %s", async (_label, patch) => {
    const res = await book(patch);
    expect(res.status).toBe(400);
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe("POST /api/bookings: the instructor must be bookable", () => {
  it("404 for an instructor that does not exist", async () => {
    expect((await book({ teacherId: "11111111-1111-4111-8111-111111111111" })).status).toBe(404);
  });

  it.each([
    ["is still pending approval", { approvalStatus: "PENDING" as const }],
    ["was rejected", { approvalStatus: "REJECTED" as const }],
    ["has not finished payout setup", { stripeOnboardingComplete: false }],
  ])("404 when the instructor %s", async (_label, patch) => {
    const t = await createInstructor({ ...patch });
    await addRule(t.profile.id, WEEKDAY, "09:00", "12:00");
    const res = await book({ teacherId: t.profile.id });
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toMatch(/isn't bookable/);
  });

  it.each(["DEACTIVATED", "SUSPENDED", "DELETED"] as const)("404 when the instructor's account is %s", async (status) => {
    const t = await createInstructor({ user: { status } });
    await addRule(t.profile.id, WEEKDAY, "09:00", "12:00");
    expect((await book({ teacherId: t.profile.id })).status).toBe(404);
  });

  it("400 when the instructor does not offer the chosen format", async () => {
    const t = await createInstructor({ formatsOffered: ["ONLINE"] });
    await addRule(t.profile.id, WEEKDAY, "09:00", "12:00");
    const res = await book({ teacherId: t.profile.id, format: "IN_PERSON" });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/format/);
  });
});

describe("POST /api/bookings: creating the hold", () => {
  it("holds the slot as PENDING_PAYMENT, owned by the signed-in student", async () => {
    const res = await book();
    expect(res.status).toBe(201);
    const { booking } = await readJson(res);
    expect(booking.status).toBe("PENDING_PAYMENT");

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.studentId).toBe(student.id);
    expect(saved.teacherId).toBe(teacher.profile.id);
    expect(saved.lessonDate).toEqual(utcMidnight(date));
    expect(saved.startTime).toBe("10:00");
    expect(saved.durationMinutes).toBe(60);
    expect(saved.format).toBe("ONLINE");
    expect(saved.cancellationWindowHours).toBe(48);
    expect(saved.cancelledAt).toBeNull();
  });

  it("ignores a studentId or status supplied by the caller", async () => {
    const other = await createStudent();
    const res = await book({ studentId: other.id, status: "CONFIRMED", priceTotalMinorUnits: 1 });
    expect(res.status).toBe(201);
    const saved = await prisma.booking.findFirstOrThrow();
    expect(saved.studentId).toBe(student.id);
    expect(saved.status).toBe("PENDING_PAYMENT");
    expect(saved.priceTotalMinorUnits).toBe(4500);
  });

  it("books in-person lessons when the instructor offers them", async () => {
    const res = await book({ format: "IN_PERSON" });
    expect(res.status).toBe(201);
    expect((await prisma.booking.findFirstOrThrow()).format).toBe("IN_PERSON");
  });

  it.each([
    [60, 4500, "10:00", 4500],
    [30, 4500, "10:00", 2250],
    [45, 4500, "09:45", 3375], // 45-minute slots start 09:00, 09:45, 10:30, 11:15
    [45, 3333, "09:45", 2500], // 2499.75 rounds to 2500
    [30, 3333, "10:00", 1667], // 1666.5 rounds up
  ])("prices a %i-minute lesson at %i pence/hour as %i pence (snapshot at booking time)", async (minutes, rate, startTime, pence) => {
    await prisma.teacherProfile.update({ where: { id: teacher.profile.id }, data: { hourlyRateMinorUnits: rate } });
    const res = await book({ durationMinutes: minutes, startTime });
    expect(res.status).toBe(201);
    expect((await prisma.booking.findFirstOrThrow()).priceTotalMinorUnits).toBe(pence);
  });

  it("keeps the booked price even if the instructor changes their rate later", async () => {
    await book();
    await prisma.teacherProfile.update({ where: { id: teacher.profile.id }, data: { hourlyRateMinorUnits: 9900 } });
    expect((await prisma.booking.findFirstOrThrow()).priceTotalMinorUnits).toBe(4500);
  });
});

describe("POST /api/bookings: only open slots can be booked", () => {
  it("409 for a time outside the instructor's hours", async () => {
    expect((await book({ startTime: "13:00" })).status).toBe(409);
    expect((await book({ startTime: "08:00" })).status).toBe(409);
  });

  it("409 for a lesson that would run past the end of the window", async () => {
    expect((await book({ startTime: "11:30", durationMinutes: 60 })).status).toBe(409);
    expect((await book({ startTime: "11:30", durationMinutes: 30 })).status).toBe(201);
  });

  it("409 for a time that is not on the slot grid", async () => {
    expect((await book({ startTime: "10:15" })).status).toBe(409);
  });

  it("409 on a day the instructor does not work", async () => {
    const otherDay = daysFromToday(2 + ((dayOfWeekOf(date) + 1 - dayOfWeekOf(daysFromToday(2)) + 7) % 7));
    expect(dayOfWeekOf(otherDay)).not.toBe(WEEKDAY);
    expect((await book({ date: otherDay })).status).toBe(409);
  });

  it("409 for a date beyond the 14-day booking window", async () => {
    const far = nextWeekday(WEEKDAY, 14);
    expect((await book({ date: far })).status).toBe(409);
  });

  it("409 for a date in the past", async () => {
    expect((await book({ date: daysFromToday(-7) })).status).toBe(409);
  });

  it("409 on a day the instructor has blocked", async () => {
    await addException(teacher.profile.id, { date, type: "BLOCKED" });
    expect((await book()).status).toBe(409);
  });

  it("201 on an extra day the instructor has added", async () => {
    const extra = daysFromToday(3);
    await addException(teacher.profile.id, { date: extra, type: "ADDED", startTime: "14:00", endTime: "16:00" });
    expect((await book({ date: extra, startTime: "14:00" })).status).toBe(201);
  });
});

describe("POST /api/bookings: double booking", () => {
  it("a second student cannot take a slot that is held", async () => {
    expect((await book()).status).toBe(201);

    const other = await createStudent();
    signInAs({ id: other.id, role: "STUDENT" });
    const res = await book();
    expect(res.status).toBe(409);
    expect(await prisma.booking.count()).toBe(1);
  });

  it("the same student cannot hold the same slot twice", async () => {
    expect((await book()).status).toBe(201);
    expect((await book()).status).toBe(409);
  });

  it("the neighbouring slot stays bookable", async () => {
    expect((await book({ startTime: "10:00" })).status).toBe(201);
    expect((await book({ startTime: "11:00" })).status).toBe(201);
    expect((await book({ startTime: "09:00" })).status).toBe(201);
  });

  it("a longer lesson blocks the shorter slots it overlaps", async () => {
    expect((await book({ startTime: "10:00", durationMinutes: 60 })).status).toBe(201);
    expect((await book({ startTime: "10:30", durationMinutes: 30 })).status).toBe(409);
    expect((await book({ startTime: "09:30", durationMinutes: 30 })).status).toBe(201);
  });

  it("a confirmed lesson blocks the slot", async () => {
    const other = await createStudent();
    await createBooking({ studentId: other.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "CONFIRMED" });
    expect((await book()).status).toBe(409);
  });

  it("a cancelled lesson frees the slot", async () => {
    const other = await createStudent();
    await createBooking({ studentId: other.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "CANCELLED" });
    expect((await book()).status).toBe(201);
  });

  it("a hold under 10 minutes old still blocks the slot", async () => {
    const other = await createStudent();
    await createBooking({
      studentId: other.id,
      teacherId: teacher.profile.id,
      date,
      startTime: "10:00",
      status: "PENDING_PAYMENT",
      createdAt: new Date(Date.now() - 5 * 60_000),
    });
    expect((await book()).status).toBe(409);
  });

  it("a hold over 10 minutes old expires: the slot reopens and the old hold is cancelled by the system", async () => {
    const other = await createStudent();
    const stale = await createBooking({
      studentId: other.id,
      teacherId: teacher.profile.id,
      date,
      startTime: "10:00",
      status: "PENDING_PAYMENT",
      createdAt: new Date(Date.now() - 11 * 60_000),
    });

    const res = await book();
    expect(res.status).toBe(201);

    const old = await prisma.booking.findUniqueOrThrow({ where: { id: stale.id } });
    expect(old.status).toBe("CANCELLED");
    expect(old.cancelledBy).toBe("SYSTEM");
    expect(old.cancelledAt).not.toBeNull();
    expect(await prisma.booking.count({ where: { status: "PENDING_PAYMENT" } })).toBe(1);
  });

  it("two students racing for the same slot: exactly one wins", async () => {
    const other = await createStudent();
    // The auth mock answers per call, so alternate who is "signed in" for each request.
    const { authMock } = await import("../helpers/auth-mock");
    authMock
      .mockResolvedValueOnce({ user: { id: student.id, role: "STUDENT" } })
      .mockResolvedValueOnce({ user: { id: other.id, role: "STUDENT" } });

    const results = await Promise.all([book(), book()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.booking.count({ where: { status: { not: "CANCELLED" } } })).toBe(1);
  });
});

describe("database guarantee against double booking", () => {
  it("rejects two live bookings for the same teacher, date and time", async () => {
    await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "CONFIRMED" });
    await expect(
      createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "PENDING_PAYMENT" })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows a new booking once the earlier one is cancelled, and many cancelled ones", async () => {
    for (let i = 0; i < 3; i++) {
      await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "CANCELLED" });
    }
    await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, startTime: "10:00", status: "CONFIRMED" });
    expect(await prisma.booking.count()).toBe(4);
  });
});
