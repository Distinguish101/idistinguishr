function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

// Emits floating local time (no Z suffix, no VTIMEZONE) rather than a
// timezone-correct UK time — consistent with the rest of the app, which
// per the data model doc's "UK only, no per-user timezone conversion"
// decision already treats stored times as literal wall-clock values
// everywhere else, not just here.
export function generateBookingIcs(params: {
  uid: string;
  teacherName: string;
  lessonDate: Date;
  startTime: string;
  durationMinutes: number;
  format: "ONLINE" | "IN_PERSON";
  locationText: string | null;
}): string {
  const { uid, teacherName, lessonDate, startTime, durationMinutes, format, locationText } = params;
  const [h, m] = startTime.split(":").map(Number);
  const y = lessonDate.getUTCFullYear();
  const mo = lessonDate.getUTCMonth() + 1;
  const d = lessonDate.getUTCDate();

  // The end is the lesson date plus the minutes, so a lesson that runs past
  // midnight ends on the next day (and rolls over the month or year if needed).
  const end = new Date(Date.UTC(y, mo - 1, d) + (h * 60 + m + durationMinutes) * 60_000);

  const dtStart = `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(m)}00`;
  const dtEnd = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}00`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const location = format === "ONLINE" ? "Online" : locationText ?? "In person";
  const summary = `Lesson with ${teacherName}`;
  const description = `Booked via IDistinguishR.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IDistinguishR//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@idistinguishr.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
