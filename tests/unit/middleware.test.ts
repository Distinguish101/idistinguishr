import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });

describe("theme middleware (?theme= share links)", () => {
  it("does nothing without a theme in the URL", () => {
    const res = middleware(req("/instructors"));
    expect(res.cookies.get("theme")).toBeUndefined();
    expect(res.headers.get("location")).toBeNull();
  });

  it("does nothing for an unknown theme", () => {
    const res = middleware(req("/?theme=neon"));
    expect(res.cookies.get("theme")).toBeUndefined();
  });

  it("remembers a valid theme in a year-long cookie", () => {
    const res = middleware(req("/?theme=midnight"));
    const cookie = res.cookies.get("theme");
    expect(cookie?.value).toBe("midnight");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 365);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("does not redirect (a redirect would need the server's internal address)", () => {
    const res = middleware(req("/about?theme=slate"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("applies the theme to the page being rendered right now, keeping other cookies", () => {
    const res = middleware(req("/?theme=slate", "session=abc; theme=cobalt; other=1"));
    expect(res.headers.get("x-middleware-request-cookie")).toBe("session=abc; other=1; theme=slate");
  });

  it("works when the request had no cookies at all", () => {
    const res = middleware(req("/?theme=slate"));
    expect(res.headers.get("x-middleware-request-cookie")).toBe("theme=slate");
  });

  it("skips static files, images and the API", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test("/")).toBe(true);
    expect(pattern.test("/instructors")).toBe(true);
    expect(pattern.test("/api/health")).toBe(false);
    expect(pattern.test("/_next/static/chunk.js")).toBe(false);
    expect(pattern.test("/_next/image")).toBe(false);
    expect(pattern.test("/favicon.ico")).toBe(false);
  });
});
