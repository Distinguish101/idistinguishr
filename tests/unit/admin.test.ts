import { afterEach, describe, expect, it } from "vitest";
import { isAdminEmail } from "@/lib/admin";

const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = original;
});

describe("isAdminEmail", () => {
  it("is false for everyone when ADMIN_EMAILS is not set", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("boss@example.com")).toBe(false);
  });

  it("is false for an empty or missing email", () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("matches an allow-listed address, ignoring case and spaces", () => {
    process.env.ADMIN_EMAILS = " Boss@Example.com , second@example.com ";
    expect(isAdminEmail("boss@example.com")).toBe(true);
    expect(isAdminEmail("BOSS@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("does not match other addresses, including partial matches", () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    expect(isAdminEmail("someone@example.com")).toBe(false);
    expect(isAdminEmail("boss@example.com.evil.test")).toBe(false);
    expect(isAdminEmail("xboss@example.com")).toBe(false);
  });

  it("ignores empty entries from stray commas", () => {
    process.env.ADMIN_EMAILS = ",,boss@example.com,";
    expect(isAdminEmail("boss@example.com")).toBe(true);
    expect(isAdminEmail("")).toBe(false);
  });
});
