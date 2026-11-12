import { describe, expect, it } from "vitest";
import { generateBookingIcs } from "@/lib/ics";

const base = {
  uid: "booking-123",
  teacherName: "Maya Okonkwo",
  lessonDate: new Date("2026-11-05T00:00:00.000Z"),
  startTime: "17:30",
  durationMinutes: 60,
  format: "ONLINE" as const,
  locationText: null,
};

function field(ics: string, name: string) {
  return ics.split("\r\n").find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1);
}

describe("generateBookingIcs", () => {
  it("builds a valid single-event calendar with CRLF line endings", () => {
    const ics = generateBookingIcs(base);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(ics).not.toMatch(/(?<!\r)\n/); // no bare LF
  });

  it("writes floating local start and end times", () => {
    const ics = generateBookingIcs(base);
    expect(field(ics, "DTSTART")).toBe("20261105T173000");
    expect(field(ics, "DTEND")).toBe("20261105T183000");
  });

  it("adds the duration across the hour boundary", () => {
    expect(field(generateBookingIcs({ ...base, startTime: "09:45", durationMinutes: 30 }), "DTEND")).toBe(
      "20261105T101500"
    );
  });

  it("uses a stable UID and a UTC DTSTAMP", () => {
    const ics = generateBookingIcs(base);
    expect(field(ics, "UID")).toBe("booking-123@idistinguishr.app");
    expect(field(ics, "DTSTAMP")).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("titles the event after the teacher", () => {
    expect(field(generateBookingIcs(base), "SUMMARY")).toBe("Lesson with Maya Okonkwo");
  });

  it("says Online for online lessons, ignoring any saved location", () => {
    expect(field(generateBookingIcs({ ...base, locationText: "Leeds" }), "LOCATION")).toBe("Online");
  });

  it("uses the location for in-person lessons, with a fallback", () => {
    expect(field(generateBookingIcs({ ...base, format: "IN_PERSON", locationText: "Leeds" }), "LOCATION")).toBe("Leeds");
    expect(field(generateBookingIcs({ ...base, format: "IN_PERSON", locationText: null }), "LOCATION")).toBe(
      "In person"
    );
  });

  it("escapes commas, semicolons, backslashes and newlines in text", () => {
    const ics = generateBookingIcs({ ...base, teacherName: "A, B; C\\D\nE" });
    expect(field(ics, "SUMMARY")).toBe("Lesson with A\\, B\\; C\\\\D\\nE");
  });

  it("moves the end date forward when the lesson passes midnight", () => {
    const ics = generateBookingIcs({ ...base, startTime: "23:30", durationMinutes: 60 });
    expect(field(ics, "DTEND")).toBe("20261106T003000");
  });

  it("rolls the end over a new month and year", () => {
    const ics = generateBookingIcs({
      ...base,
      lessonDate: new Date("2026-12-31T00:00:00Z"),
      startTime: "23:30",
      durationMinutes: 60,
    });
    expect(field(ics, "DTSTART")).toBe("20261231T233000");
    expect(field(ics, "DTEND")).toBe("20270101T003000");
  });
});
