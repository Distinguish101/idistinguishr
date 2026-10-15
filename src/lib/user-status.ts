import type { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Sessions are stateless JWTs, so on their own they stay valid after an
// account is suspended, deactivated or deleted. src/lib/auth.ts asks this
// helper whether the account is still ACTIVE. Results are cached per pod for
// a short time so a page that calls auth() several times doesn't hit the DB
// each time; the pod that handles a status change drops its own entry
// immediately, other pods catch up within the TTL.
const TTL_MS = 60_000;
const cache = new Map<string, { status: UserStatus | null; at: number }>();

export async function getUserStatus(userId: string): Promise<UserStatus | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.status;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  const status = user?.status ?? null;
  cache.set(userId, { status, at: Date.now() });
  return status;
}

export function forgetUserStatus(userId: string) {
  cache.delete(userId);
}
