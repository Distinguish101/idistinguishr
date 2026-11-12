import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Resend SDK is replaced by a recorder, so these tests check what we would
// send without sending anything.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

async function loadEmail(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules(); // email.ts reads its settings once, at import time
  return import("@/lib/email");
}

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "SITE_URL", "ADMIN_EMAILS"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  send.mockReset();
  send.mockResolvedValue({ data: { id: "1" }, error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const booking = {
  to: "student@example.test",
  studentName: "Sam",
  teacherName: "Maya",
  lessonDate: new Date("2026-11-05T00:00:00.000Z"),
  startTime: "17:30",
  durationMinutes: 60,
  format: "ONLINE" as const,
  locationText: null,
  priceTotalMinorUnits: 4500,
};

describe("without a Resend key", () => {
  it("skips every email quietly instead of failing", async () => {
    const email = await loadEmail({ RESEND_API_KEY: undefined, ADMIN_EMAILS: "admin@example.test" });
    await email.sendBookingConfirmationEmail(booking);
    await email.sendPasswordResetEmail({ to: "a@example.test", fullName: "A", token: "t" });
    await email.sendTeacherReviewNeededEmail({ teacherName: "T", teacherEmail: "t@example.test", reason: "r" });
    expect(await email.sendContactMessageEmail({ name: "n", email: "e@example.test", topic: "General", message: "m" })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("sendBookingConfirmationEmail", () => {
  it("sends the lesson details with the price in pounds", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", EMAIL_FROM: "Me <me@example.test>" });
    await email.sendBookingConfirmationEmail(booking);
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe("Me <me@example.test>");
    expect(msg.to).toEqual(["student@example.test"]);
    expect(msg.subject).toBe("You're booked with Maya — Thursday 5 November");
    expect(msg.html).toContain("17:30");
    expect(msg.html).toContain("60 min");
    expect(msg.html).toContain("£45.00");
    expect(msg.html).toContain("Online");
  });

  it("shows the location for in-person lessons", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    await email.sendBookingConfirmationEmail({ ...booking, format: "IN_PERSON", locationText: "Leeds studio" });
    expect(send.mock.calls[0][0].html).toContain("Leeds studio");
  });

  it("does not throw if sending fails", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    send.mockRejectedValue(new Error("network down"));
    await expect(email.sendBookingConfirmationEmail(booking)).resolves.toBeUndefined();
  });

  it("escapes HTML in the student name, teacher name and location", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    await email.sendBookingConfirmationEmail({
      ...booking,
      studentName: "<script>x</script>",
      teacherName: "<b>T</b>",
      format: "IN_PERSON",
      locationText: "<img src=x>",
    });
    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>T</b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });
});

describe("sendPasswordResetEmail", () => {
  it("links to the reset page on the site with the encoded token", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", SITE_URL: "https://site.example.test" });
    await email.sendPasswordResetEmail({ to: "a@example.test", fullName: "Ann", token: "a+b/c=" });
    const msg = send.mock.calls[0][0];
    expect(msg.to).toEqual(["a@example.test"]);
    expect(msg.html).toContain("https://site.example.test/reset-password?token=a%2Bb%2Fc%3D");
    expect(msg.subject).toBe("Reset your IDistinguishR password");
  });

  it("strips markup characters from the name", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    await email.sendPasswordResetEmail({ to: "a@example.test", fullName: `<b>"Ann" & Co</b>`, token: "t" });
    const html: string = send.mock.calls[0][0].html;
    expect(html).toContain("Hi bAnn  Co/b,");
    expect(html).not.toContain("<b>");
  });

  it("logs an API-level rejection without throwing", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    send.mockResolvedValue({ data: null, error: { message: "invalid key" } });
    await expect(email.sendPasswordResetEmail({ to: "a@example.test", fullName: "A", token: "t" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not throw when the SDK throws", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key" });
    send.mockRejectedValue(new Error("boom"));
    await expect(email.sendPasswordResetEmail({ to: "a@example.test", fullName: "A", token: "t" })).resolves.toBeUndefined();
  });
});

describe("sendContactMessageEmail", () => {
  const message = { name: "Visitor", email: "visitor@example.test", topic: "Help", message: "Hello\nthere" };

  it("goes to every admin address, with Reply-To set to the visitor", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test, b@example.test" });
    expect(await email.sendContactMessageEmail(message)).toBe(true);
    const msg = send.mock.calls[0][0];
    expect(msg.to).toEqual(["a@example.test", "b@example.test"]);
    expect(msg.replyTo).toBe("visitor@example.test");
    expect(msg.subject).toBe("Contact form (Help) — Visitor");
  });

  it("escapes HTML in everything the visitor typed", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test" });
    await email.sendContactMessageEmail({ name: "<i>N</i>", email: "v@example.test", topic: "<T>", message: `<script>alert("x")</script>` });
    const html: string = send.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("truncates a long name in the subject", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test" });
    await email.sendContactMessageEmail({ ...message, name: "N".repeat(200) });
    expect(send.mock.calls[0][0].subject).toBe(`Contact form (Help) — ${"N".repeat(60)}`);
  });

  it("reports not delivered when there are no admin addresses", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "" });
    expect(await email.sendContactMessageEmail(message)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("reports not delivered when Resend rejects or throws", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test" });
    send.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    expect(await email.sendContactMessageEmail(message)).toBe(false);
    send.mockRejectedValueOnce(new Error("boom"));
    expect(await email.sendContactMessageEmail(message)).toBe(false);
  });
});

describe("sendTeacherReviewNeededEmail", () => {
  it("tells the admins who needs review and why", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test", SITE_URL: "https://site.example.test" });
    await email.sendTeacherReviewNeededEmail({ teacherName: "Maya", teacherEmail: "maya@example.test", reason: "Bio too short" });
    const msg = send.mock.calls[0][0];
    expect(msg.to).toEqual(["a@example.test"]);
    expect(msg.subject).toBe("Instructor profile needs review — Maya");
    expect(msg.html).toContain("Bio too short");
    expect(msg.html).toContain("https://site.example.test/admin");
  });

  it("escapes HTML in the instructor's name, email and the reason", async () => {
    const email = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test" });
    await email.sendTeacherReviewNeededEmail({
      teacherName: "<script>x</script>",
      teacherEmail: "t<i>@example.test",
      reason: "<b>bad</b>",
    });
    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("<b>bad</b>");
  });

  it("does nothing without admin addresses, and never throws on failure", async () => {
    const none = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "" });
    await none.sendTeacherReviewNeededEmail({ teacherName: "M", teacherEmail: "m@example.test", reason: "r" });
    expect(send).not.toHaveBeenCalled();

    const some = await loadEmail({ RESEND_API_KEY: "key", ADMIN_EMAILS: "a@example.test" });
    send.mockRejectedValue(new Error("boom"));
    await expect(some.sendTeacherReviewNeededEmail({ teacherName: "M", teacherEmail: "m@example.test", reason: "r" })).resolves.toBeUndefined();
  });
});
