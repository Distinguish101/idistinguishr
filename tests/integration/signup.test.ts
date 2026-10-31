import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/signup/route";
import { prisma } from "@/lib/prisma";
import { jsonRequest, rawRequest, readJson } from "../helpers/http";
import { createStudent, resetDb } from "../helpers/factories";

const signup = (body: unknown) => POST(jsonRequest("/api/auth/signup", "POST", body));

const valid = { fullName: "Sam Smith", email: "sam@example.test", password: "Correct-horse-9", role: "STUDENT" };

beforeEach(resetDb);

describe("POST /api/auth/signup", () => {
  it("creates a student account and stores a bcrypt hash, never the password", async () => {
    const res = await signup(valid);
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "sam@example.test" } });
    expect(user.role).toBe("STUDENT");
    expect(user.fullName).toBe("Sam Smith");
    expect(user.status).toBe("ACTIVE");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(user.passwordHash).not.toContain("Correct-horse-9");
    expect(await bcrypt.compare("Correct-horse-9", user.passwordHash!)).toBe(true);
  });

  it("can create an instructor account (without a profile yet)", async () => {
    const res = await signup({ ...valid, role: "TEACHER" });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email }, include: { teacherProfile: true } });
    expect(user.role).toBe("TEACHER");
    expect(user.teacherProfile).toBeNull();
  });

  it("tidies the input: trims the name, lower-cases the email", async () => {
    await signup({ ...valid, fullName: "  Sam Smith  ", email: "  SAM@Example.TEST " });
    const user = await prisma.user.findFirstOrThrow();
    expect(user.fullName).toBe("Sam Smith");
    expect(user.email).toBe("sam@example.test");
  });

  it("refuses a second account with the same email, whatever its capitalisation", async () => {
    await createStudent({ email: "sam@example.test" });
    const res = await signup({ ...valid, email: "SAM@example.test" });
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toMatch(/already exists/);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ["a missing name", { fullName: undefined }],
    ["a one-letter name", { fullName: "S" }],
    ["a name over 100 characters", { fullName: "S".repeat(101) }],
    ["a missing email", { email: undefined }],
    ["an invalid email", { email: "not-an-email" }],
    ["a missing password", { password: undefined }],
    ["a password under 8 characters", { password: "abc12" }],
    ["a password over 72 characters (bcrypt's limit)", { password: "a1".repeat(37) }],
    ["a role of ADMIN", { role: "ADMIN" }],
    ["a missing role", { role: undefined }],
  ])("rejects %s", async (_label, patch) => {
    const res = await signup({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(typeof (await readJson(res)).error).toBe("string");
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects a body that is not JSON, or empty", async () => {
    expect((await POST(rawRequest("/api/auth/signup", "POST", "{broken", {}))).status).toBe(400);
    expect((await POST(rawRequest("/api/auth/signup", "POST", "", {}))).status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("enforces the password rules with a clear message", async () => {
    let res = await signup({ ...valid, password: "password123" });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/too common/);

    res = await signup({ ...valid, password: "onlyletters" });
    expect((await readJson(res)).error).toMatch(/number/);

    res = await signup({ ...valid, email: "samantha@example.test", password: "Samantha-2026" });
    expect((await readJson(res)).error).toMatch(/email name/);
    expect(await prisma.user.count()).toBe(0);
  });

  it("does not let a caller set fields it should not (status, id)", async () => {
    await signup({ ...valid, status: "SUSPENDED", id: "custom-id" });
    const user = await prisma.user.findFirstOrThrow();
    expect(user.status).toBe("ACTIVE");
    expect(user.id).not.toBe("custom-id");
  });
});
