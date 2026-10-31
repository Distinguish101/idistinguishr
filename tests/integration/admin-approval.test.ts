import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);

import { PATCH } from "@/app/api/admin/teachers/[id]/route";
import { prisma } from "@/lib/prisma";
import { signInAs, signOut } from "../helpers/auth-mock";
import { createInstructor, createStudent, resetDb } from "../helpers/factories";
import { jsonRequest, params, rawRequest, readJson } from "../helpers/http";

const ADMIN_EMAIL = "admin@example.test";
let teacher: Awaited<ReturnType<typeof createInstructor>>;

const patch = (id: string, body: unknown) => PATCH(jsonRequest(`/api/admin/teachers/${id}`, "PATCH", body), params({ id }));
const status = async () => (await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.profile.id } })).approvalStatus;

beforeAll(() => {
  process.env.ADMIN_EMAILS = ` ${ADMIN_EMAIL}, other-admin@example.test`;
});
afterAll(() => {
  delete process.env.ADMIN_EMAILS;
});
beforeEach(async () => {
  await resetDb();
  teacher = await createInstructor({ approvalStatus: "PENDING" });
  signInAs({ id: "admin-id", role: "STUDENT", email: ADMIN_EMAIL });
});

describe("PATCH /api/admin/teachers/[id]", () => {
  it("lets an admin approve a pending instructor", async () => {
    const res = await patch(teacher.profile.id, { approvalStatus: "APPROVED" });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });
    expect(await status()).toBe("APPROVED");
  });

  it("lets an admin reject, and change their mind later", async () => {
    await patch(teacher.profile.id, { approvalStatus: "REJECTED" });
    expect(await status()).toBe("REJECTED");
    await patch(teacher.profile.id, { approvalStatus: "APPROVED" });
    expect(await status()).toBe("APPROVED");
  });

  it("matches admin emails regardless of capitalisation", async () => {
    signInAs({ id: "admin-id", role: "STUDENT", email: "ADMIN@Example.Test" });
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(200);
  });

  it("changes nothing but the approval status", async () => {
    const before = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.profile.id } });
    await patch(teacher.profile.id, { approvalStatus: "APPROVED", bio: "hacked", hourlyRateMinorUnits: 1 });
    const after = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.profile.id } });
    expect(after).toEqual({ ...before, approvalStatus: "APPROVED" });
  });

  it("401 for a signed-in user who is not an admin", async () => {
    signInAs({ id: teacher.user.id, role: "TEACHER", email: teacher.user.email });
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(401);
    expect(await status()).toBe("PENDING");
  });

  it("401 with no session, or a session without an email", async () => {
    signOut();
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(401);
    signInAs({ id: "x", role: "STUDENT", email: null });
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(401);
  });

  it("401 for everyone when no admin addresses are configured", async () => {
    delete process.env.ADMIN_EMAILS;
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(401);
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  });

  it.each([
    ["PENDING", { approvalStatus: "PENDING" }],
    ["a made-up status", { approvalStatus: "SUPER_APPROVED" }],
    ["a missing status", {}],
    ["an unrelated field", { bio: "x" }],
    ["lower case", { approvalStatus: "approved" }],
  ])("400 for %s", async (_label, body) => {
    const res = await patch(teacher.profile.id, body);
    expect(res.status).toBe(400);
    expect(await status()).toBe("PENDING");
  });

  it("400 for a body that is not JSON, or null", async () => {
    expect((await PATCH(rawRequest("/x", "PATCH", "{bad", {}), params({ id: teacher.profile.id }))).status).toBe(400);
    expect((await patch(teacher.profile.id, null)).status).toBe(400);
  });

  it("404 for an instructor that does not exist", async () => {
    expect((await patch("00000000-0000-4000-8000-000000000000", { approvalStatus: "APPROVED" })).status).toBe(404);
  });

  it("a student account cannot approve, even with a matching role elsewhere", async () => {
    const s = await createStudent();
    signInAs({ id: s.id, role: "STUDENT", email: s.email });
    expect((await patch(teacher.profile.id, { approvalStatus: "APPROVED" })).status).toBe(401);
  });
});
