import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET } from "@/app/api/health/route";

const get = (query = "") => GET(new Request(`http://localhost/api/health${query}`));

beforeEach(() => {
  queryRaw.mockReset();
});

describe("GET /api/health", () => {
  it("liveness: reports ok without touching the database", async () => {
    queryRaw.mockImplementation(async () => {
      throw new Error("db is down");
    });
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("liveness: only ready=1 triggers the database check", async () => {
    await get("?ready=0");
    await get("?ready=true");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("readiness: ok when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await get("?ready=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("readiness: 503 with the reason when the database is unreachable", async () => {
    queryRaw.mockImplementation(async () => {
      throw new Error("Can't reach database server");
    });
    const res = await get("?ready=1");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", error: "Can't reach database server" });
  });

  it("readiness: copes with a non-Error rejection", async () => {
    queryRaw.mockImplementation(async () => {
      throw "plain string";
    });
    const res = await get("?ready=1");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("plain string");
  });
});
