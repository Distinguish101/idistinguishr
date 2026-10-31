import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { POST } from "@/app/api/reviews/route";
import { prisma } from "@/lib/prisma";
import { authMock, signInAs, signOut } from "../helpers/auth-mock";
import { daysFromToday } from "../helpers/dates";
import { createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, readJson } from "../helpers/http";

let student: Awaited<ReturnType<typeof createStudent>>;
let teacher: Awaited<ReturnType<typeof createInstructor>>;
let n = 0;

const review = (body: Record<string, unknown>) => POST(jsonRequest("/api/reviews", "POST", body));
const completed = (o: Partial<Parameters<typeof createBooking>[0]> = {}) =>
  createBooking({
    studentId: student.id,
    teacherId: teacher.profile.id,
    date: daysFromToday(-14),
    startTime: `${String(8 + n++).padStart(2, "0")}:00`, // distinct slot each time
    status: "COMPLETED",
    ...o,
  });
const stats = async () => {
  const p = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.profile.id } });
  return { avg: Number(p.avgRating), count: p.reviewCount };
};

beforeEach(async () => {
  await resetDb();
  n = 0;
  student = await createStudent();
  teacher = await createInstructor();
  signInAs({ id: student.id, role: "STUDENT" });
});

describe("POST /api/reviews", () => {
  it("saves a review of a completed lesson and updates the instructor's rating", async () => {
    const b = await completed();
    const res = await review({ bookingId: b.id, rating: 5, comment: "Brilliant lesson" });
    expect(res.status).toBe(201);

    const saved = await prisma.review.findUniqueOrThrow({ where: { bookingId: b.id } });
    expect(saved).toMatchObject({ rating: 5, comment: "Brilliant lesson", studentId: student.id, teacherId: teacher.profile.id });
    expect(await stats()).toEqual({ avg: 5, count: 1 });
  });

  it("stores no comment as null, and trims the comment", async () => {
    const a = await completed();
    await review({ bookingId: a.id, rating: 4 });
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId: a.id } })).comment).toBeNull();

    const b = await completed();
    await review({ bookingId: b.id, rating: 4, comment: "   " });
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId: b.id } })).comment).toBeNull();

    const c = await completed();
    await review({ bookingId: c.id, rating: 4, comment: "  Good  " });
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId: c.id } })).comment).toBe("Good");
  });

  it("recalculates the average and count from all reviews", async () => {
    await review({ bookingId: (await completed()).id, rating: 4 });
    expect(await stats()).toEqual({ avg: 4, count: 1 });
    await review({ bookingId: (await completed()).id, rating: 5 });
    expect(await stats()).toEqual({ avg: 4.5, count: 2 });
    await review({ bookingId: (await completed()).id, rating: 1 });
    expect(await stats()).toEqual({ avg: 3.3, count: 3 }); // 10/3 = 3.33, stored to one decimal
  });

  it("only counts reviews of this instructor", async () => {
    const other = await createInstructor();
    const otherBooking = await createBooking({ studentId: student.id, teacherId: other.profile.id, date: daysFromToday(-14), status: "COMPLETED" });
    await review({ bookingId: otherBooking.id, rating: 1 });
    await review({ bookingId: (await completed()).id, rating: 5 });
    expect(await stats()).toEqual({ avg: 5, count: 1 });
  });

  it("accepts the lowest and highest ratings", async () => {
    expect((await review({ bookingId: (await completed()).id, rating: 1 })).status).toBe(201);
    expect((await review({ bookingId: (await completed()).id, rating: 5 })).status).toBe(201);
  });

  it.each([
    ["a rating of 0", { rating: 0 }],
    ["a rating of 6", { rating: 6 }],
    ["a fractional rating", { rating: 3.5 }],
    ["a rating sent as text", { rating: "5" }],
    ["a missing rating", { rating: undefined }],
    ["a booking id that is not a UUID", { bookingId: "nope" }],
    ["a comment over 2000 characters", { comment: "x".repeat(2001) }],
  ])("rejects %s", async (_label, patch) => {
    const b = await completed();
    const res = await review({ bookingId: b.id, rating: 5, ...patch });
    expect(res.status).toBe(400);
    expect(await prisma.review.count()).toBe(0);
  });

  it("is for signed-in students only", async () => {
    const b = await completed();
    signOut();
    expect((await review({ bookingId: b.id, rating: 5 })).status).toBe(401);
    signInAs({ id: teacher.user.id, role: "TEACHER" });
    expect((await review({ bookingId: b.id, rating: 5 })).status).toBe(401);
    expect(await prisma.review.count()).toBe(0);
  });

  it("404 for another student's lesson, and for one that does not exist", async () => {
    const other = await createStudent();
    const b = await createBooking({ studentId: other.id, teacherId: teacher.profile.id, date: daysFromToday(-14), status: "COMPLETED" });
    expect((await review({ bookingId: b.id, rating: 5 })).status).toBe(404);
    expect((await review({ bookingId: "00000000-0000-4000-8000-000000000000", rating: 5 })).status).toBe(404);
    expect(await prisma.review.count()).toBe(0);
  });

  it.each(["CONFIRMED", "PENDING_PAYMENT", "CANCELLED"] as const)("refuses a %s lesson: only completed ones can be reviewed", async (status) => {
    const b = await completed({ status });
    const res = await review({ bookingId: b.id, rating: 5 });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/completed/);
    expect(await prisma.review.count()).toBe(0);
  });

  it("allows one review per lesson", async () => {
    const b = await completed();
    expect((await review({ bookingId: b.id, rating: 5 })).status).toBe(201);
    const again = await review({ bookingId: b.id, rating: 1 });
    expect(again.status).toBe(409);
    expect(await prisma.review.count()).toBe(1);
    expect(await stats()).toEqual({ avg: 5, count: 1 });
  });

  it("two simultaneous submissions for one lesson: one review is saved and the other is told it is a duplicate", async () => {
    const b = await completed();
    authMock.mockResolvedValue({ user: { id: student.id, role: "STUDENT" } });
    const results = await Promise.allSettled([review({ bookingId: b.id, rating: 5 }), review({ bookingId: b.id, rating: 4 })]);

    expect(await prisma.review.count()).toBe(1);
    expect((await stats()).count).toBe(1);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : "crashed")).sort();
    expect(statuses).toEqual([201, 409]);
  });
});
