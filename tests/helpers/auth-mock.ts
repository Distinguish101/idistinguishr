import { vi } from "vitest";

// A stand-in for the app's `auth()` (the signed-in session). Test files install it with:
//   vi.mock("@/lib/auth", async () => (await import("../helpers/auth-mock")).authModule);
// and then choose who is signed in with signInAs(...) / signOut().

export const authMock = vi.fn();
export const authModule = { auth: authMock };

export type TestSessionUser = { id: string; role: "STUDENT" | "TEACHER"; email?: string | null; name?: string | null };

export function signInAs(user: TestSessionUser) {
  authMock.mockResolvedValue({ user: { email: null, name: null, ...user } });
}

export function signOut() {
  authMock.mockResolvedValue(null);
}
