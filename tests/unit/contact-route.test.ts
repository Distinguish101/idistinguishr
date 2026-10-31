import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendContactMessageEmail } = vi.hoisted(() => ({ sendContactMessageEmail: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendContactMessageEmail }));

import { POST } from "@/app/api/contact/route";
import { CONTACT_TOPICS } from "@/lib/contact";
import { jsonRequest, rawRequest, readJson } from "../helpers/http";

const valid = {
  name: "Sam Smith",
  email: "Sam@Example.com",
  topic: "Accessibility",
  message: "Hello, I have a question about the site.",
};

let ipCounter = 0;
/** Each test uses its own client address so the in-memory rate limit never carries over. */
const post = (body: unknown, ip = `203.0.113.${++ipCounter}`) =>
  POST(jsonRequest("/api/contact", "POST", body, { "x-forwarded-for": ip }));

beforeEach(() => {
  sendContactMessageEmail.mockReset();
  sendContactMessageEmail.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe("POST /api/contact", () => {
  it("sends the message and tidies the input (trimmed, email lower-cased)", async () => {
    const res = await post({ ...valid, name: "  Sam Smith  " });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });
    expect(sendContactMessageEmail).toHaveBeenCalledWith({
      name: "Sam Smith",
      email: "sam@example.com",
      topic: "Accessibility",
      message: "Hello, I have a question about the site.",
    });
  });

  it("accepts every listed topic", async () => {
    for (const topic of CONTACT_TOPICS) {
      expect((await post({ ...valid, topic })).status).toBe(200);
    }
  });

  it.each([
    ["a name that is too short", { name: "S" }, "Please enter your name."],
    ["an invalid email", { email: "not-an-email" }, "Please enter a valid email address."],
    ["a message that is too short", { message: "Hi" }, "Please write at least a sentence."],
  ])("rejects %s with a readable message", async (_label, patch, error) => {
    const res = await post({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe(error);
    expect(sendContactMessageEmail).not.toHaveBeenCalled();
  });

  it("rejects an unknown topic, an over-long message, and a missing field", async () => {
    expect((await post({ ...valid, topic: "Free money" })).status).toBe(400);
    expect((await post({ ...valid, message: "x".repeat(4001) })).status).toBe(400);
    expect((await post({ name: "Sam Smith" })).status).toBe(400);
  });

  it("rejects a body that is not JSON, or not an object", async () => {
    const ip = { "x-forwarded-for": "198.51.100.9" };
    expect((await POST(rawRequest("/api/contact", "POST", "{nope", ip))).status).toBe(400);
    expect((await POST(rawRequest("/api/contact", "POST", "null", ip))).status).toBe(400);
  });

  it("answers a filled honeypot with success but sends nothing", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });
    expect(sendContactMessageEmail).not.toHaveBeenCalled();
  });

  it("says so honestly when the email could not be sent", async () => {
    sendContactMessageEmail.mockResolvedValue(false);
    const res = await post(valid);
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toMatch(/couldn't send your message/);
  });

  it("allows five messages an hour from one address, then blocks the sixth", async () => {
    const ip = "192.0.2.50";
    for (let i = 0; i < 5; i++) expect((await post(valid, ip)).status).toBe(200);
    const blocked = await post(valid, ip);
    expect(blocked.status).toBe(429);
    expect((await readJson(blocked)).error).toMatch(/try again in an hour/);
    expect(sendContactMessageEmail).toHaveBeenCalledTimes(5);
  });

  it("limits each address separately, using the first address in x-forwarded-for", async () => {
    const ip = "192.0.2.60";
    for (let i = 0; i < 5; i++) await post(valid, `${ip}, 10.0.0.1`);
    expect((await post(valid, `${ip}, 10.9.9.9`)).status).toBe(429); // same first address
    expect((await post(valid, "192.0.2.61")).status).toBe(200); // someone else
  });

  it("lets the same address send again after the hour is up", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    const ip = "192.0.2.70";
    for (let i = 0; i < 5; i++) await post(valid, ip);
    expect((await post(valid, ip)).status).toBe(429);
    vi.setSystemTime(new Date("2026-11-04T11:00:01Z"));
    expect((await post(valid, ip)).status).toBe(200);
  });

  it("does not count rejected or honeypot submissions against the limit", async () => {
    const ip = "192.0.2.80";
    for (let i = 0; i < 6; i++) await post({ ...valid, message: "short" }, ip);
    for (let i = 0; i < 6; i++) await post({ ...valid, website: "x" }, ip);
    expect((await post(valid, ip)).status).toBe(200);
  });
});
