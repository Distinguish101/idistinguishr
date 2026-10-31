import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

import { forgetUserStatus, getUserStatus } from "@/lib/user-status";

beforeEach(() => {
  findUnique.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("getUserStatus (per-process cache, 60 seconds)", () => {
  it("looks the status up once, then serves it from the cache", async () => {
    findUnique.mockResolvedValue({ status: "ACTIVE" });
    expect(await getUserStatus("u-cache")).toBe("ACTIVE");
    expect(await getUserStatus("u-cache")).toBe("ACTIVE");
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u-cache" }, select: { status: true } });
  });

  it("asks again once 60 seconds have passed", async () => {
    findUnique.mockResolvedValueOnce({ status: "ACTIVE" }).mockResolvedValueOnce({ status: "SUSPENDED" });
    expect(await getUserStatus("u-ttl")).toBe("ACTIVE");
    vi.advanceTimersByTime(59_000);
    expect(await getUserStatus("u-ttl")).toBe("ACTIVE");
    vi.advanceTimersByTime(2_000);
    expect(await getUserStatus("u-ttl")).toBe("SUSPENDED");
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("returns null for a user that no longer exists, and caches that too", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getUserStatus("u-gone")).toBeNull();
    expect(await getUserStatus("u-gone")).toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("forgetUserStatus makes the next call hit the database", async () => {
    findUnique.mockResolvedValueOnce({ status: "ACTIVE" }).mockResolvedValueOnce({ status: "DEACTIVATED" });
    expect(await getUserStatus("u-forget")).toBe("ACTIVE");
    forgetUserStatus("u-forget");
    expect(await getUserStatus("u-forget")).toBe("DEACTIVATED");
  });

  it("keeps users separate", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      status: where.id === "u-a" ? "ACTIVE" : "DELETED",
    }));
    expect(await getUserStatus("u-a")).toBe("ACTIVE");
    expect(await getUserStatus("u-b")).toBe("DELETED");
  });
});
