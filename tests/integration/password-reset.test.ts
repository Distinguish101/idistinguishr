import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendPasswordResetEmail } = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail }));

import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { hashResetToken, newResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { createUser, PASSWORD, resetDb } from "../helpers/factories";
import { jsonRequest, rawRequest, readJson } from "../helpers/http";

const requestReset = (email: unknown) => forgot(jsonRequest("/api/auth/forgot-password", "POST", { email }));
const submitReset = (body: unknown) => reset(jsonRequest("/api/auth/reset-password", "POST", body));
const GENERIC = { ok: true };
const NEW_PASSWORD = "Brand-new-pass-42";

/** Makes a reset token directly in the database, as the forgot-password route would. */
async function issueToken(userId: string, o: { expiresAt?: Date; usedAt?: Date | null; createdAt?: Date } = {}) {
  const { token, tokenHash } = newResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: o.expiresAt ?? new Date(Date.now() + RESET_TOKEN_TTL_MS),
      usedAt: o.usedAt ?? null,
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
  return token;
}

beforeEach(async () => {
  await resetDb();
  sendPasswordResetEmail.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("POST /api/auth/forgot-password", () => {
  it("creates a one-hour token and emails the raw token, storing only its hash", async () => {
    const user = await createUser({ email: "sam@example.test", fullName: "Sam" });
    const before = Date.now();
    const res = await requestReset("sam@example.test");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual(GENERIC);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const sent = sendPasswordResetEmail.mock.calls[0][0];
    expect(sent).toMatchObject({ to: "sam@example.test", fullName: "Sam" });

    const [row] = await prisma.passwordResetToken.findMany();
    expect(row.userId).toBe(user.id);
    expect(row.tokenHash).toBe(hashResetToken(sent.token));
    expect(row.tokenHash).not.toBe(sent.token);
    expect(row.usedAt).toBeNull();
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(RESET_TOKEN_TTL_MS - 1000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(RESET_TOKEN_TTL_MS + 5000);
  });

  it("gives the identical answer for an address with no account, and sends nothing", async () => {
    const res = await requestReset("nobody@example.test");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual(GENERIC);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("matches the address regardless of capitalisation or spaces", async () => {
    await createUser({ email: "sam@example.test" });
    await requestReset("  SAM@Example.TEST ");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an account with no password (Google-only)", async () => {
    await createUser({ email: "g@example.test", password: null });
    expect(await readJson(await requestReset("g@example.test"))).toEqual(GENERIC);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it.each(["SUSPENDED", "DELETED"] as const)("does nothing for a %s account, with the same answer", async (status) => {
    await createUser({ email: "x@example.test", status });
    expect(await readJson(await requestReset("x@example.test"))).toEqual(GENERIC);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("works for a deactivated account (signing in reactivates it)", async () => {
    await createUser({ email: "x@example.test", status: "DEACTIVATED" });
    await requestReset("x@example.test");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("sends at most 3 emails an hour per account, staying silent (same answer) after that", async () => {
    await createUser({ email: "sam@example.test" });
    for (let i = 0; i < 3; i++) await requestReset("sam@example.test");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);

    const res = await requestReset("sam@example.test");
    expect(await readJson(res)).toEqual(GENERIC);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
    expect(await prisma.passwordResetToken.count()).toBe(3);
  });

  it("does not count tokens older than an hour towards the limit", async () => {
    const user = await createUser({ email: "sam@example.test" });
    for (let i = 0; i < 3; i++) await issueToken(user.id, { createdAt: new Date(Date.now() - 61 * 60_000) });
    await requestReset("sam@example.test");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("limits each account separately", async () => {
    await createUser({ email: "a@example.test" });
    await createUser({ email: "b@example.test" });
    for (let i = 0; i < 4; i++) await requestReset("a@example.test");
    await requestReset("b@example.test");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(4); // 3 for a, 1 for b
  });

  it.each([["not-an-email"], [""], [undefined], [42], [null]])("400 for an invalid email (%s)", async (email) => {
    const res = await requestReset(email);
    expect(res.status).toBe(400);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("400 for a body that is not JSON", async () => {
    expect((await forgot(rawRequest("/x", "POST", "{nope", {}))).status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("sets the new password and uses up the token", async () => {
    const user = await createUser({ email: "sam@example.test" });
    const token = await issueToken(user.id);

    const res = await submitReset({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, saved.passwordHash!)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, saved.passwordHash!)).toBe(false);
    const row = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashResetToken(token) } });
    expect(row.usedAt).not.toBeNull();
  });

  it("works only once per link", async () => {
    const user = await createUser();
    const token = await issueToken(user.id);
    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(200);

    const again = await submitReset({ token, password: "Another-pass-77" });
    expect(again.status).toBe(400);
    expect((await readJson(again)).error).toMatch(/invalid or has expired/);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, saved.passwordHash!)).toBe(true);
  });

  it("also cancels the account's other outstanding links", async () => {
    const user = await createUser();
    const first = await issueToken(user.id);
    const second = await issueToken(user.id);
    await submitReset({ token: first, password: NEW_PASSWORD });
    expect((await submitReset({ token: second, password: "Another-pass-77" })).status).toBe(400);
  });

  it("leaves other people's links alone", async () => {
    const a = await createUser();
    const b = await createUser();
    const tokenA = await issueToken(a.id);
    const tokenB = await issueToken(b.id);
    await submitReset({ token: tokenA, password: NEW_PASSWORD });
    expect((await submitReset({ token: tokenB, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("refuses an expired link", async () => {
    const user = await createUser();
    const token = await issueToken(user.id, { expiresAt: new Date(Date.now() - 1000) });
    const res = await submitReset({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(PASSWORD, saved.passwordHash!)).toBe(true);
  });

  it("expires exactly an hour after it was issued", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    const user = await createUser();
    const token = await issueToken(user.id);
    vi.setSystemTime(new Date("2026-11-04T10:59:59Z"));
    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(200);

    const user2 = await createUser();
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    const token2 = await issueToken(user2.id);
    vi.setSystemTime(new Date("2026-11-04T11:00:01Z"));
    expect((await submitReset({ token: token2, password: NEW_PASSWORD })).status).toBe(400);
  });

  it("refuses a link that was never issued, and a link already marked used", async () => {
    const user = await createUser();
    expect((await submitReset({ token: "x".repeat(43), password: NEW_PASSWORD })).status).toBe(400);
    const used = await issueToken(user.id, { usedAt: new Date() });
    expect((await submitReset({ token: used, password: NEW_PASSWORD })).status).toBe(400);
  });

  it.each(["SUSPENDED", "DELETED"] as const)("refuses a link for a %s account", async (status) => {
    const user = await createUser({ status });
    const token = await issueToken(user.id);
    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(400);
  });

  it("lets a deactivated account reset its password", async () => {
    const user = await createUser({ status: "DEACTIVATED" });
    const token = await issueToken(user.id);
    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("applies the signup password rules, and keeps the link usable after a rejected password", async () => {
    const user = await createUser({ email: "samantha@example.test" });
    const token = await issueToken(user.id);

    let res = await submitReset({ token, password: "password123" });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatch(/too common/);

    res = await submitReset({ token, password: "Samantha-2026" });
    expect((await readJson(res)).error).toMatch(/email name/);

    res = await submitReset({ token, password: "lettersonly" });
    expect((await readJson(res)).error).toMatch(/number/);

    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(200);
  });

  it.each([
    ["a token that is too short", { token: "short", password: NEW_PASSWORD }],
    ["a token that is too long", { token: "x".repeat(201), password: NEW_PASSWORD }],
    ["a missing token", { password: NEW_PASSWORD }],
    ["a password under 8 characters", { token: "x".repeat(43), password: "a1" }],
    ["a password over 72 characters", { token: "x".repeat(43), password: "a1".repeat(37) }],
    ["a missing password", { token: "x".repeat(43) }],
  ])("400 for %s", async (_label, body) => {
    expect((await submitReset(body)).status).toBe(400);
  });

  it("400 for a body that is not JSON", async () => {
    expect((await reset(rawRequest("/x", "POST", "{nope", {}))).status).toBe(400);
  });

  it("two submissions racing with the same link: exactly one succeeds", async () => {
    const user = await createUser();
    const token = await issueToken(user.id);
    const results = await Promise.all([
      submitReset({ token, password: "First-winner-11" }),
      submitReset({ token, password: "Second-winner-22" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });
});

describe("the whole flow: forgot, then reset", () => {
  it("emailed token resets the password; the old one stops working", async () => {
    const user = await createUser({ email: "sam@example.test" });
    await requestReset("sam@example.test");
    const { token } = sendPasswordResetEmail.mock.calls[0][0];

    expect((await submitReset({ token, password: NEW_PASSWORD })).status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, saved.passwordHash!)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, saved.passwordHash!)).toBe(false);
  });
});
