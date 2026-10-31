import { describe, expect, it } from "vitest";
import { hashResetToken, newResetToken, RESET_MAX_PER_HOUR, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";

describe("password reset tokens", () => {
  it("makes a long url-safe token and a matching SHA-256 hash", () => {
    const { token, tokenHash } = newResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(token)).toBe(tokenHash);
  });

  it("never repeats a token", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newResetToken().token));
    expect(tokens.size).toBe(200);
  });

  it("stores a hash that does not reveal the token", () => {
    const { token, tokenHash } = newResetToken();
    expect(tokenHash).not.toContain(token);
  });

  it("hashes deterministically and differently for different inputs", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
    expect(hashResetToken("abc")).not.toBe(hashResetToken("abd"));
    // Known SHA-256 of "abc"
    expect(hashResetToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("keeps the documented limits", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
    expect(RESET_MAX_PER_HOUR).toBe(3);
  });
});
