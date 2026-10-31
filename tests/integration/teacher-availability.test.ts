import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { GET as listRules, POST as addRulePost } from "@/app/api/teacher/availability/rules/route";
import { DELETE as deleteRule } from "@/app/api/teacher/availability/rules/[id]/route";
import { GET as listExceptions, POST as addExceptionPost } from "@/app/api/teacher/availability/exceptions/route";
import { DELETE as deleteException } from "@/app/api/teacher/availability/exceptions/[id]/route";
import { prisma } from "@/lib/prisma";
import { signInAs, signOut } from "../helpers/auth-mock";
import { addException, addRule, createInstructor, createStudent, createUser, resetDb } from "../helpers/factories";
import { jsonRequest, params, rawRequest, readJson } from "../helpers/http";

let teacher: Awaited<ReturnType<typeof createInstructor>>;
let other: Awaited<ReturnType<typeof createInstructor>>;

const postRule = (body: unknown) => addRulePost(jsonRequest("/api/teacher/availability/rules", "POST", body));
const postException = (body: unknown) => addExceptionPost(jsonRequest("/api/teacher/availability/exceptions", "POST", body));
const delRule = (id: string) => deleteRule(jsonRequest(`/x/${id}`, "DELETE"), params({ id }));
const delException = (id: string) => deleteException(jsonRequest(`/x/${id}`, "DELETE"), params({ id }));

beforeEach(async () => {
  await resetDb();
  teacher = await createInstructor();
  other = await createInstructor();
  signInAs({ id: teacher.user.id, role: "TEACHER" });
});

describe("who may manage availability", () => {
  it("is for signed-in instructors with a profile only", async () => {
    const student = await createStudent();
    const noProfile = await createUser({ role: "TEACHER" });
    const callers: (() => void)[] = [
      () => signOut(),
      () => signInAs({ id: student.id, role: "STUDENT" }),
      () => signInAs({ id: noProfile.id, role: "TEACHER" }),
    ];
    for (const become of callers) {
      become();
      expect((await listRules()).status).toBe(401);
      expect((await postRule({ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" })).status).toBe(401);
      expect((await listExceptions()).status).toBe(401);
      expect((await postException({ date: "2026-11-05", type: "BLOCKED", startTime: null, endTime: null })).status).toBe(401);
      expect((await delRule("any")).status).toBe(401);
      expect((await delException("any")).status).toBe(401);
    }
    expect(await prisma.availabilityRule.count()).toBe(0);
    expect(await prisma.availabilityException.count()).toBe(0);
  });
});

describe("weekly rules", () => {
  it("lists only my rules, ordered by day then start time", async () => {
    await addRule(teacher.profile.id, 3, "14:00", "15:00");
    await addRule(teacher.profile.id, 1, "16:00", "17:00");
    await addRule(teacher.profile.id, 1, "09:00", "10:00");
    await addRule(other.profile.id, 0, "09:00", "10:00");
    const { rules } = await readJson(await listRules());
    expect(rules.map((r: any) => [r.dayOfWeek, r.startTime])).toEqual([
      [1, "09:00"],
      [1, "16:00"],
      [3, "14:00"],
    ]);
  });

  it("creates a rule for me", async () => {
    const res = await postRule({ dayOfWeek: 2, startTime: "09:00", endTime: "12:30" });
    expect(res.status).toBe(201);
    const { rule } = await readJson(res);
    expect(rule).toMatchObject({ teacherId: teacher.profile.id, dayOfWeek: 2, startTime: "09:00", endTime: "12:30" });
    expect(await prisma.availabilityRule.count()).toBe(1);
  });

  it("ignores a teacherId in the body (always saved against the signed-in instructor)", async () => {
    await postRule({ dayOfWeek: 2, startTime: "09:00", endTime: "10:00", teacherId: other.profile.id });
    expect((await prisma.availabilityRule.findFirstOrThrow()).teacherId).toBe(teacher.profile.id);
  });

  it.each([
    ["the same range", "09:00", "10:00"],
    ["a range that starts inside", "09:30", "10:30"],
    ["a range that ends inside", "08:30", "09:30"],
    ["a range that contains it", "08:00", "11:00"],
    ["a range inside it", "09:15", "09:45"],
  ])("409 for %s on the same day", async (_label, start, end) => {
    await addRule(teacher.profile.id, 1, "09:00", "10:00");
    const res = await postRule({ dayOfWeek: 1, startTime: start, endTime: end });
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toMatch(/overlaps/);
    expect(await prisma.availabilityRule.count()).toBe(1);
  });

  it("allows back-to-back slots, other days, and another instructor's overlapping time", async () => {
    await addRule(teacher.profile.id, 1, "09:00", "10:00");
    await addRule(other.profile.id, 1, "09:00", "10:00");
    expect((await postRule({ dayOfWeek: 1, startTime: "10:00", endTime: "11:00" })).status).toBe(201);
    expect((await postRule({ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" })).status).toBe(201);
    expect((await postRule({ dayOfWeek: 2, startTime: "09:00", endTime: "10:00" })).status).toBe(201);
    expect((await postRule({ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" })).status).toBe(409);
  });

  it.each([
    ["a day below 0", { dayOfWeek: -1 }],
    ["a day above 6", { dayOfWeek: 7 }],
    ["a fractional day", { dayOfWeek: 1.5 }],
    ["a day sent as text", { dayOfWeek: "1" }],
    ["a time without a leading zero", { startTime: "9:00" }],
    ["an hour past 23", { endTime: "24:00" }],
    ["minutes past 59", { startTime: "09:60" }],
    ["an empty start", { startTime: "" }],
    ["a missing end", { endTime: undefined }],
  ])("400 for %s", async (_label, patch) => {
    const res = await postRule({ dayOfWeek: 1, startTime: "09:00", endTime: "10:00", ...patch });
    expect(res.status).toBe(400);
    expect(await prisma.availabilityRule.count()).toBe(0);
  });

  it("400 when the end is not after the start", async () => {
    for (const [s, e] of [["10:00", "10:00"], ["11:00", "10:00"]]) {
      const res = await postRule({ dayOfWeek: 1, startTime: s, endTime: e });
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toBe("End time must be after start time.");
    }
  });

  it("400 for a body that is not JSON", async () => {
    expect((await addRulePost(rawRequest("/x", "POST", "{nope", {}))).status).toBe(400);
  });

  it("deletes my rule", async () => {
    const rule = await addRule(teacher.profile.id, 1, "09:00", "10:00");
    expect((await delRule(rule.id)).status).toBe(200);
    expect(await prisma.availabilityRule.count()).toBe(0);
  });

  it("404 deleting someone else's rule, or one that does not exist; theirs is untouched", async () => {
    const theirs = await addRule(other.profile.id, 1, "09:00", "10:00");
    expect((await delRule(theirs.id)).status).toBe(404);
    expect((await delRule("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect(await prisma.availabilityRule.count()).toBe(1);
  });
});

describe("one-off exceptions", () => {
  it("lists only mine, oldest date first, with plain YYYY-MM-DD dates", async () => {
    await addException(teacher.profile.id, { date: "2026-12-01", type: "BLOCKED" });
    await addException(teacher.profile.id, { date: "2026-11-05", type: "ADDED", startTime: "14:00", endTime: "15:00" });
    await addException(other.profile.id, { date: "2026-11-01", type: "BLOCKED" });
    const { exceptions } = await readJson(await listExceptions());
    expect(exceptions.map((e: any) => e.date)).toEqual(["2026-11-05", "2026-12-01"]);
    expect(exceptions[0]).toMatchObject({ type: "ADDED", startTime: "14:00", endTime: "15:00" });
  });

  it("blocks a whole day (no times)", async () => {
    const res = await postException({ date: "2026-11-05", type: "BLOCKED", startTime: null, endTime: null });
    expect(res.status).toBe(201);
    const { exception } = await readJson(res);
    expect(exception).toMatchObject({ date: "2026-11-05", type: "BLOCKED", startTime: null, endTime: null, teacherId: teacher.profile.id });
  });

  it("blocks part of a day, and adds extra hours", async () => {
    expect((await postException({ date: "2026-11-05", type: "BLOCKED", startTime: "10:00", endTime: "11:00" })).status).toBe(201);
    expect((await postException({ date: "2026-11-06", type: "ADDED", startTime: "14:00", endTime: "16:00" })).status).toBe(201);
    expect(await prisma.availabilityException.count()).toBe(2);
  });

  it("stores the date as that calendar day (no timezone drift)", async () => {
    await postException({ date: "2026-03-29", type: "BLOCKED", startTime: null, endTime: null }); // UK clocks go forward
    const saved = await prisma.availabilityException.findFirstOrThrow();
    expect(saved.date.toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });

  it.each([
    ["only a start time", { startTime: "10:00", endTime: null }],
    ["only an end time", { startTime: null, endTime: "11:00" }],
  ])("400 with %s: give both or neither", async (_label, times) => {
    const res = await postException({ date: "2026-11-05", type: "BLOCKED", ...times });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/both start and end time/);
  });

  it("400 when the end is not after the start", async () => {
    for (const [s, e] of [["11:00", "10:00"], ["10:00", "10:00"]]) {
      const res = await postException({ date: "2026-11-05", type: "ADDED", startTime: s, endTime: e });
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toBe("End time must be after start time.");
    }
  });

  it.each([
    ["a date in the wrong format", { date: "05-11-2026" }],
    ["a missing date", { date: undefined }],
    ["an unknown type", { type: "HOLIDAY" }],
    ["a missing type", { type: undefined }],
    ["a bad time", { startTime: "9am", endTime: "10:00" }],
    ["times left out entirely", { startTime: undefined, endTime: undefined }],
  ])("400 for %s", async (_label, patch) => {
    const res = await postException({ date: "2026-11-05", type: "BLOCKED", startTime: null, endTime: null, ...patch });
    expect(res.status).toBe(400);
    expect(await prisma.availabilityException.count()).toBe(0);
  });

  it("400 for a body that is not JSON", async () => {
    expect((await addExceptionPost(rawRequest("/x", "POST", "{nope", {}))).status).toBe(400);
  });

  it("deletes mine; 404 for someone else's or an unknown one", async () => {
    const mine = await addException(teacher.profile.id, { date: "2026-11-05", type: "BLOCKED" });
    const theirs = await addException(other.profile.id, { date: "2026-11-05", type: "BLOCKED" });
    expect((await delException(theirs.id)).status).toBe(404);
    expect((await delException("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await delException(mine.id)).status).toBe(200);
    expect(await prisma.availabilityException.count()).toBe(1);
  });
});
