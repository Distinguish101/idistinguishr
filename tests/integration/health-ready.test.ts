import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

const get = (query = "") => GET(new Request(`http://localhost/api/health${query}`));

describe("GET /api/health against a real database", () => {
  it("liveness answers ok", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("readiness answers ok when the database responds to a real query", async () => {
    const res = await get("?ready=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
