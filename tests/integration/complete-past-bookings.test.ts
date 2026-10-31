import { beforeEach, describe, expect, it } from "vitest";
import { completePastBookings } from "@/lib/complete-past-bookings";
import { prisma } from "@/lib/prisma";
import { daysFromToday } from "../helpers/dates";
import { createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";

let student: Awaited<ReturnType<typeof createStudent>>;
let teacher: Awaited<ReturnType<typeof createInstructor>>;
let slot = 0;
const make = (date: string, status: Parameters<typeof createBooking>[0]["status"] = "CONFIRMED") =>
  createBooking({ studentId: student.id, teacherId: teacher.profile.id, date, status, startTime: `${String(8 + slot++).padStart(2, "0")}:00` });
const statusOf = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

beforeEach(async () => {
  await resetDb();
  slot = 0;
  student = await createStudent();
  teacher = await createInstructor();
});

describe("completePastBookings", () => {
  it("completes confirmed lessons whose date has passed", async () => {
    const yesterday = await make(daysFromToday(-1));
    const lastMonth = await make(daysFromToday(-30));
    await completePastBookings();
    expect(await statusOf(yesterday.id)).toBe("COMPLETED");
    expect(await statusOf(lastMonth.id)).toBe("COMPLETED");
  });

  it("leaves today's and future lessons alone", async () => {
    const today = await make(daysFromToday(0));
    const future = await make(daysFromToday(3));
    await completePastBookings();
    expect(await statusOf(today.id)).toBe("CONFIRMED");
    expect(await statusOf(future.id)).toBe("CONFIRMED");
  });

  it("only touches confirmed lessons: cancelled, pending and already-completed stay as they are", async () => {
    const cancelled = await make(daysFromToday(-5), "CANCELLED");
    const pending = await make(daysFromToday(-5), "PENDING_PAYMENT");
    const done = await make(daysFromToday(-5), "COMPLETED");
    await completePastBookings();
    expect(await statusOf(cancelled.id)).toBe("CANCELLED");
    expect(await statusOf(pending.id)).toBe("PENDING_PAYMENT");
    expect(await statusOf(done.id)).toBe("COMPLETED");
  });

  it("covers everyone's bookings, not just one student's or instructor's", async () => {
    const other = await createStudent();
    const otherTeacher = await createInstructor();
    const mine = await make(daysFromToday(-2));
    const theirs = await createBooking({ studentId: other.id, teacherId: otherTeacher.profile.id, date: daysFromToday(-2) });
    await completePastBookings();
    expect(await statusOf(mine.id)).toBe("COMPLETED");
    expect(await statusOf(theirs.id)).toBe("COMPLETED");
  });

  it("can be run repeatedly, and with nothing to do", async () => {
    await completePastBookings();
    const b = await make(daysFromToday(-1));
    await completePastBookings();
    await completePastBookings();
    expect(await statusOf(b.id)).toBe("COMPLETED");
  });

  it("makes a lesson reviewable only after it has been completed", async () => {
    const b = await make(daysFromToday(-1));
    expect(await statusOf(b.id)).toBe("CONFIRMED");
    await completePastBookings();
    expect(await statusOf(b.id)).toBe("COMPLETED");
  });
});
