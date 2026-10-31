import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { GET } from "@/app/api/bookings/[id]/ics/route";
import { signInAs, signOut } from "../helpers/auth-mock";
import { createBooking, createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, params, readJson } from "../helpers/http";

let student: Awaited<ReturnType<typeof createStudent>>;
let teacher: Awaited<ReturnType<typeof createInstructor>>;

const getIcs = (id: string) => GET(jsonRequest(`/api/bookings/${id}/ics`, "GET"), params({ id }));

beforeEach(async () => {
  await resetDb();
  student = await createStudent();
  teacher = await createInstructor({ user: { fullName: "Maya Okonkwo" }, locationText: "Leeds studio" });
  signInAs({ id: student.id, role: "STUDENT" });
});

describe("GET /api/bookings/[id]/ics", () => {
  it("downloads a calendar file for a confirmed lesson", async () => {
    const b = await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: "2026-11-05", startTime: "17:30", durationMinutes: 45 });
    const res = await getIcs(b.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="lesson.ics"');

    const ics = await res.text();
    expect(ics).toContain(`UID:${b.id}@idistinguishr.app`);
    expect(ics).toContain("SUMMARY:Lesson with Maya Okonkwo");
    expect(ics).toContain("DTSTART:20261105T173000");
    expect(ics).toContain("DTEND:20261105T181500");
    expect(ics).toContain("LOCATION:Online");
  });

  it("uses the instructor's location for in-person lessons", async () => {
    const b = await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: "2026-11-05", format: "IN_PERSON" });
    expect(await (await getIcs(b.id)).text()).toContain("LOCATION:Leeds studio");
  });

  it("also works for a completed lesson", async () => {
    const b = await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: "2026-10-01", status: "COMPLETED" });
    expect((await getIcs(b.id)).status).toBe(200);
  });

  it.each(["PENDING_PAYMENT", "CANCELLED"] as const)("400 for a %s booking", async (status) => {
    const b = await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: "2026-11-05", status });
    const res = await getIcs(b.id);
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/isn't confirmed/);
  });

  it("401 without a session", async () => {
    const b = await createBooking({ studentId: student.id, teacherId: teacher.profile.id, date: "2026-11-05" });
    signOut();
    expect((await getIcs(b.id)).status).toBe(401);
  });

  it("404 for another student's booking, and for an unknown id", async () => {
    const other = await createStudent();
    const b = await createBooking({ studentId: other.id, teacherId: teacher.profile.id, date: "2026-11-05" });
    expect((await getIcs(b.id)).status).toBe(404);
    expect((await getIcs("00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});
