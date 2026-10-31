import { describe, expect, it } from "vitest";
import { passwordIssue } from "@/lib/password";

describe("passwordIssue (signup password rules)", () => {
  it("accepts a strong password", () => {
    expect(passwordIssue("Correct-horse-9")).toBeNull();
  });

  it("accepts exactly 8 characters with a letter and a number", () => {
    expect(passwordIssue("abcdefg1")).toBeNull();
  });

  it("rejects fewer than 8 characters", () => {
    expect(passwordIssue("abc123")).toBe("Use at least 8 characters.");
    expect(passwordIssue("")).toBe("Use at least 8 characters.");
  });

  it("requires a letter", () => {
    expect(passwordIssue("12345678")).toBe("Include at least one letter.");
  });

  it("requires a number", () => {
    expect(passwordIssue("abcdefgh")).toBe("Include at least one number.");
  });

  it("rejects common passwords, whatever the capitalisation", () => {
    expect(passwordIssue("password1")).toMatch(/too common/);
    expect(passwordIssue("PassWord123")).toMatch(/too common/);
    expect(passwordIssue("Qwerty123")).toMatch(/too common/);
  });

  it("rejects a password containing the email name (4+ characters)", () => {
    expect(passwordIssue("Sarah-1234-xyz", "sarah@example.com")).toMatch(/email name/);
    expect(passwordIssue("MYSARAH99!", "Sarah@Example.com")).toMatch(/email name/);
  });

  it("ignores a short email name (under 4 characters)", () => {
    expect(passwordIssue("Amy-Correct-9", "amy@example.com")).toBeNull();
  });

  it("does not check the email name when no email is given", () => {
    expect(passwordIssue("Sarah-1234-xyz")).toBeNull();
  });

  it("checks length, letter and number before the other rules, in that order", () => {
    // A single repeated character can never reach the 'repeat' rule: it always
    // fails the letter or number rule first, so that branch is unreachable.
    expect(passwordIssue("aaaaaaaa")).toBe("Include at least one number.");
    expect(passwordIssue("11111111")).toBe("Include at least one letter.");
  });
});
