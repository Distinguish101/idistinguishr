import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { POST as deactivate } from "@/app/api/account/deactivate/route";
import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { upcomingLessonCount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { getUserStatus } from "@/lib/user-status";
import { signInAs, signOut } from "../helpers/auth-mock";
import { daysFromToday } from "../helpers/dates";
import { clearStorageEnv, startFakeS3, useStorageEnv } from "../helpers/fake-s3";
import { addException, addRule, createBooking, createInstructor, createStudent, createUser, PASSWORD, resetDb } from "../helpers/factories";
import { jsonRequest, rawRequest, readJson } from "../helpers/http";

let s3: Awaited<ReturnType<typeof startFakeS3>>;
beforeAll(async () => {
  s3 = await startFakeS3();
});
afterAll(async () => {
  clearStorageEnv();
  await s3.close();
});
beforeEach(async () => {
  await resetDb();
  s3.clear();
  clearStorageEnv();
});

const doDeactivate = () => deactivate();
const doDelete = (body: unknown) => deleteAccount(jsonRequest("/api/account/delete", "POST", body));
const statusOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).status;

describe("upcomingLessonCount", () => {
  it("counts confirmed lessons from today onwards, as student or as instructor", async () => {
    const student = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: student.id, teacherId: t.profile.id, date: daysFromToday(0), startTime: "09:00" });
    await createBooking({ studentId: student.id, teacherId: t.profile.id, date: daysFromToday(5), startTime: "09:00" });
    expect(await upcomingLessonCount(student.id)).toBe(2);
    expect(await upcomingLessonCount(t.user.id)).toBe(2);
  });

  it("ignores past, cancelled, pending and completed lessons, and other people's", async () => {
    const student = await createStudent();
    const other = await createStudent();
    const t = await createInstructor();
    const base = { studentId: student.id, teacherId: t.profile.id };
    await createBooking({ ...base, date: daysFromToday(-1), startTime: "09:00" });
    await createBooking({ ...base, date: daysFromToday(3), startTime: "09:00", status: "CANCELLED" });
    await createBooking({ ...base, date: daysFromToday(3), startTime: "10:00", status: "PENDING_PAYMENT" });
    await createBooking({ ...base, date: daysFromToday(3), startTime: "11:00", status: "COMPLETED" });
    expect(await upcomingLessonCount(student.id)).toBe(0);
    expect(await upcomingLessonCount(other.id)).toBe(0);
  });
});

describe("POST /api/account/deactivate", () => {
  it("switches the account off, and the status check sees it straight away", async () => {
    const u = await createStudent();
    signInAs({ id: u.id, role: "STUDENT" });
    expect(await getUserStatus(u.id)).toBe("ACTIVE"); // warm the cache
    const res = await doDeactivate();
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });
    expect(await statusOf(u.id)).toBe("DEACTIVATED");
    expect(await getUserStatus(u.id)).toBe("DEACTIVATED");
  });

  it("keeps everything: nothing is deleted", async () => {
    const t = await createInstructor({ bio: "A long enough bio for the profile here." });
    await addRule(t.profile.id, 1, "09:00", "10:00");
    signInAs({ id: t.user.id, role: "TEACHER" });
    await doDeactivate();
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: t.profile.id } })).bio).toMatch(/long enough/);
    expect(await prisma.availabilityRule.count()).toBe(1);
  });

  it("401 without a session", async () => {
    signOut();
    expect((await doDeactivate()).status).toBe(401);
  });

  it("409 while the student has an upcoming lesson, and leaves the account active", async () => {
    const u = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: u.id, teacherId: t.profile.id, date: daysFromToday(4) });
    signInAs({ id: u.id, role: "STUDENT" });
    const res = await doDeactivate();
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toMatch(/upcoming lessons/);
    expect(await statusOf(u.id)).toBe("ACTIVE");
  });

  it("409 while the instructor has an upcoming lesson booked with them", async () => {
    const student = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: student.id, teacherId: t.profile.id, date: daysFromToday(4) });
    signInAs({ id: t.user.id, role: "TEACHER" });
    expect((await doDeactivate()).status).toBe(409);
    expect(await statusOf(t.user.id)).toBe("ACTIVE");
  });

  it("is allowed once the lessons are cancelled or in the past", async () => {
    const u = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: u.id, teacherId: t.profile.id, date: daysFromToday(4), status: "CANCELLED" });
    await createBooking({ studentId: u.id, teacherId: t.profile.id, date: daysFromToday(-4), startTime: "11:00" });
    signInAs({ id: u.id, role: "STUDENT" });
    expect((await doDeactivate()).status).toBe(200);
  });

  it("an instructor who deactivates drops out of search", async () => {
    const { searchTeachers } = await import("@/lib/teacher-search");
    const t = await createInstructor();
    expect((await searchTeachers({})).total).toBe(1);
    signInAs({ id: t.user.id, role: "TEACHER" });
    await doDeactivate();
    expect((await searchTeachers({})).total).toBe(0);
  });
});

describe("POST /api/account/delete", () => {
  it("anonymises the user, frees the email, and keeps the account row for bookings and reviews", async () => {
    const u = await createStudent({ email: "sam@example.test", fullName: "Sam Smith" });
    signInAs({ id: u.id, role: "STUDENT" });
    const res = await doDelete({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(saved.status).toBe("DELETED");
    expect(saved.fullName).toBe("Deleted user");
    expect(saved.email).toBe(`deleted-${u.id}@deleted.invalid`);
    expect(saved.passwordHash).toBeNull();

    // The address can be used again by a new account.
    const again = await createStudent({ email: "sam@example.test" });
    expect(again.id).not.toBe(u.id);
  });

  it("removes an instructor's profile text, photo link, availability and reset links, but keeps their bookings", async () => {
    const t = await createInstructor({ locationText: "Leeds", photoUrl: "https://example.test/p.jpg", approvalStatus: "APPROVED" });
    const student = await createStudent();
    await addRule(t.profile.id, 1, "09:00", "10:00");
    await addException(t.profile.id, { date: daysFromToday(3), type: "BLOCKED" });
    await prisma.passwordResetToken.create({ data: { userId: t.user.id, tokenHash: "h".repeat(64), expiresAt: new Date(Date.now() + 1e6) } });
    const past = await createBooking({ studentId: student.id, teacherId: t.profile.id, date: daysFromToday(-10), status: "COMPLETED" });
    await prisma.review.create({ data: { bookingId: past.id, studentId: student.id, teacherId: t.profile.id, rating: 5 } });

    signInAs({ id: t.user.id, role: "TEACHER" });
    expect((await doDelete({ password: PASSWORD })).status).toBe(200);

    const profile = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: t.profile.id } });
    expect(profile).toMatchObject({ bio: "", credentials: "", photoUrl: null, locationText: null, approvalStatus: "REJECTED" });
    expect(await prisma.availabilityRule.count()).toBe(0);
    expect(await prisma.availabilityException.count()).toBe(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.review.count()).toBe(1);
  });

  it("makes the deleted instructor unbookable and out of search", async () => {
    const { searchTeachers } = await import("@/lib/teacher-search");
    const t = await createInstructor();
    signInAs({ id: t.user.id, role: "TEACHER" });
    await doDelete({ password: PASSWORD });
    expect((await searchTeachers({})).total).toBe(0);
  });

  it("deletes the instructor's uploaded photo from storage", async () => {
    useStorageEnv(s3.endpoint);
    const t = await createInstructor({ photoUrl: "https://images.example.test/photos/u1/abc.jpg" });
    signInAs({ id: t.user.id, role: "TEACHER" });
    await doDelete({ password: PASSWORD });
    expect(s3.deletes().map((r) => r.url)).toEqual(["/test-bucket/photos/u1/abc.jpg"]);
  });

  it("still deletes the account if the storage delete fails", async () => {
    useStorageEnv(s3.endpoint);
    vi.spyOn(console, "error").mockImplementation(() => {});
    s3.failWith(500);
    const t = await createInstructor({ photoUrl: "https://images.example.test/photos/u1/abc.jpg" });
    signInAs({ id: t.user.id, role: "TEACHER" });
    expect((await doDelete({ password: PASSWORD })).status).toBe(200);
    expect(await statusOf(t.user.id)).toBe("DELETED");
  });

  it("does not touch storage for a pasted photo link that is not ours", async () => {
    useStorageEnv(s3.endpoint);
    const t = await createInstructor({ photoUrl: "https://elsewhere.test/photo.jpg" });
    signInAs({ id: t.user.id, role: "TEACHER" });
    await doDelete({ password: PASSWORD });
    expect(s3.requests).toHaveLength(0);
  });

  it("refuses a wrong or missing password, and changes nothing", async () => {
    const u = await createStudent({ fullName: "Sam Smith" });
    signInAs({ id: u.id, role: "STUDENT" });
    for (const body of [{ password: "Wrong-password-1" }, {}, { password: "" }, { confirmText: "DELETE" }]) {
      const res = await doDelete(body);
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toBe("Incorrect password.");
    }
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(saved.status).toBe("ACTIVE");
    expect(saved.fullName).toBe("Sam Smith");
    expect(await bcrypt.compare(PASSWORD, saved.passwordHash!)).toBe(true);
  });

  it("an account without a password (Google sign-in) must type DELETE", async () => {
    const u = await createUser({ password: null, fullName: "Gail Google" });
    signInAs({ id: u.id, role: "STUDENT" });
    for (const body of [{}, { confirmText: "delete" }, { confirmText: "yes" }, { password: PASSWORD }]) {
      const res = await doDelete(body);
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toBe("Type DELETE to confirm.");
    }
    expect(await statusOf(u.id)).toBe("ACTIVE");
    expect((await doDelete({ confirmText: "DELETE" })).status).toBe(200);
    expect(await statusOf(u.id)).toBe("DELETED");
  });

  it("409 while there are upcoming lessons, even with the right password", async () => {
    const u = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: u.id, teacherId: t.profile.id, date: daysFromToday(4) });
    signInAs({ id: u.id, role: "STUDENT" });
    const res = await doDelete({ password: PASSWORD });
    expect(res.status).toBe(409);
    expect(await statusOf(u.id)).toBe("ACTIVE");
  });

  it("checks the password before revealing anything about lessons", async () => {
    const u = await createStudent();
    const t = await createInstructor();
    await createBooking({ studentId: u.id, teacherId: t.profile.id, date: daysFromToday(4) });
    signInAs({ id: u.id, role: "STUDENT" });
    expect((await doDelete({ password: "Wrong-password-1" })).status).toBe(400);
  });

  it("401 without a session", async () => {
    signOut();
    expect((await doDelete({ password: PASSWORD })).status).toBe(401);
  });

  it("400 for a malformed body", async () => {
    const u = await createStudent();
    signInAs({ id: u.id, role: "STUDENT" });
    expect((await deleteAccount(rawRequest("/x", "POST", "{nope", {}))).status).toBe(400);
    expect((await doDelete({ password: 12345 })).status).toBe(400);
    expect((await doDelete({ password: "x".repeat(73) })).status).toBe(400);
  });

  it("404 for an account that is already deleted, or does not exist", async () => {
    const u = await createStudent();
    signInAs({ id: u.id, role: "STUDENT" });
    await doDelete({ password: PASSWORD });
    expect((await doDelete({ password: PASSWORD })).status).toBe(404);

    signInAs({ id: "00000000-0000-4000-8000-000000000000", role: "STUDENT" });
    expect((await doDelete({ password: PASSWORD })).status).toBe(404);
  });

  it("the status check sees the deletion straight away", async () => {
    const u = await createStudent();
    signInAs({ id: u.id, role: "STUDENT" });
    expect(await getUserStatus(u.id)).toBe("ACTIVE");
    await doDelete({ password: PASSWORD });
    expect(await getUserStatus(u.id)).toBe("DELETED");
  });
});
