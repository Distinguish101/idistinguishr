import { createHash, randomBytes } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// Reset emails per account per hour. Beyond this we stay silent (the caller
// still returns the same generic response) so the form can't be used to spam
// someone's inbox.
export const RESET_MAX_PER_HOUR = 3;

export function newResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
