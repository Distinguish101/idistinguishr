import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the configuration the app hands to Auth.js, so the sign-in rules
// (authorize) and the session callbacks can be run directly against the database.
const captured = vi.hoisted(() => ({ config: null as any }));
vi.mock("next-auth", () => ({
  default: (config: unknown) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (opts: object) => ({ id: "credentials", ...opts }) }));
vi.mock("next-auth/providers/google", () => ({ default: (opts: object) => ({ id: "google", ...opts }) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));

import "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forgetUserStatus } from "@/lib/user-status";
import { createUser, PASSWORD, resetDb } from "../helpers/factories";

const authorize = (creds: unknown) =>
  captured.config.providers.find((p: { id: string }) => p.id === "credentials").authorize(creds);

beforeEach(resetDb);

describe("Auth.js configuration", () => {
  it("uses stateless sessions, the custom sign-in page, and email/password plus Google", () => {
    expect(captured.config.session).toEqual({ strategy: "jwt" });
    expect(captured.config.pages).toEqual({ signIn: "/auth" });
    expect(captured.config.providers.map((p: { id: string }) => p.id).sort()).toEqual(["credentials", "google"]);
  });
});

describe("sign in with email and password (authorize)", () => {
  it("returns the user for the right email and password", async () => {
    const u = await createUser({ email: "sam@example.test", fullName: "Sam Smith", role: "TEACHER" });
    expect(await authorize({ email: "sam@example.test", password: PASSWORD })).toEqual({
      id: u.id,
      email: "sam@example.test",
      name: "Sam Smith",
      role: "TEACHER",
    });
  });

  it("finds the account whatever the capitalisation or surrounding spaces of the typed email", async () => {
    const u = await createUser({ email: "sam@example.test" });
    for (const typed of ["Sam@Example.Test", "SAM@EXAMPLE.TEST", "  sam@example.test  "]) {
      expect((await authorize({ email: typed, password: PASSWORD }))?.id, typed).toBe(u.id);
    }
  });

  it("rejects a wrong password, an unknown email, and missing details", async () => {
    await createUser({ email: "sam@example.test" });
    expect(await authorize({ email: "sam@example.test", password: "Wrong-password-1" })).toBeNull();
    expect(await authorize({ email: "nobody@example.test", password: PASSWORD })).toBeNull();
    expect(await authorize({ email: "sam@example.test" })).toBeNull();
    expect(await authorize({ password: PASSWORD })).toBeNull();
    expect(await authorize({ email: "", password: "" })).toBeNull();
    expect(await authorize(undefined)).toBeNull();
  });

  it("rejects an account that has no password (Google-only) however it is asked", async () => {
    await createUser({ email: "g@example.test", password: null });
    expect(await authorize({ email: "g@example.test", password: "anything-1" })).toBeNull();
    expect(await authorize({ email: "g@example.test", password: "" })).toBeNull();
  });

  it("blocks suspended and deleted accounts even with the right password", async () => {
    await createUser({ email: "s@example.test", status: "SUSPENDED" });
    await createUser({ email: "d@example.test", status: "DELETED" });
    expect(await authorize({ email: "s@example.test", password: PASSWORD })).toBeNull();
    expect(await authorize({ email: "d@example.test", password: PASSWORD })).toBeNull();
  });

  it("signing in to a deactivated account switches it back on", async () => {
    const u = await createUser({ email: "x@example.test", status: "DEACTIVATED" });
    const result = await authorize({ email: "x@example.test", password: PASSWORD });
    expect(result?.id).toBe(u.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("ACTIVE");
  });

  it("a wrong password does not reactivate a deactivated account", async () => {
    const u = await createUser({ email: "x@example.test", status: "DEACTIVATED" });
    expect(await authorize({ email: "x@example.test", password: "Wrong-password-1" })).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("DEACTIVATED");
  });

  it("does not need the stored hash to be recomputed: any valid bcrypt hash works", async () => {
    const u = await createUser({ email: "h@example.test", password: null });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash("Another-pass-7", 10) } });
    expect((await authorize({ email: "h@example.test", password: "Another-pass-7" }))?.id).toBe(u.id);
  });
});

describe("session callbacks", () => {
  const jwtCb = (args: unknown) => captured.config.callbacks.jwt(args);
  const sessionCb = (args: unknown) => captured.config.callbacks.session(args);

  it("jwt: on sign-in, copies the id and role into the token", async () => {
    const token = await jwtCb({ token: {}, user: { id: "u1", role: "TEACHER" } });
    expect(token).toMatchObject({ id: "u1", role: "TEACHER" });
  });

  it("jwt: keeps the session while the account is active", async () => {
    const u = await createUser();
    forgetUserStatus(u.id);
    const token = { id: u.id, role: "STUDENT" };
    expect(await jwtCb({ token })).toBe(token);
  });

  it.each(["SUSPENDED", "DEACTIVATED", "DELETED"] as const)("jwt: ends the session when the account becomes %s", async (status) => {
    const u = await createUser({ status });
    forgetUserStatus(u.id);
    expect(await jwtCb({ token: { id: u.id, role: "STUDENT" } })).toBeNull();
  });

  it("jwt: ends the session for an account that no longer exists", async () => {
    expect(await jwtCb({ token: { id: "00000000-0000-4000-8000-000000000000", role: "STUDENT" } })).toBeNull();
  });

  it("session: exposes the id and role to the app", async () => {
    const out = await sessionCb({ session: { user: { name: "A" } }, token: { id: "u1", role: "STUDENT" } });
    expect(out.user).toMatchObject({ name: "A", id: "u1", role: "STUDENT" });
  });
});
