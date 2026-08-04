import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OpenWindow = { date: string; startTime: string; endTime: string };

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Computes open time windows for the next `days` calendar days by applying
// AvailabilityException on top of the recurring AvailabilityRule pattern —
// per the data model doc, slots are computed at request time, not
// pre-generated. Doesn't subtract existing bookings yet since Booking
// doesn't exist as a concept until the booking-flow step; revisit there.
// A BLOCKED exception with a time range drops any rule window it overlaps
// entirely (rather than splitting the window around it) — good enough for
// a preview/filter, but not precise enough for actual slot selection,
// which the booking step will need to handle properly.
export async function getUpcomingAvailability(teacherId: string, days = 14): Promise<OpenWindow[]> {
  const today = startOfTodayUTC();
  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { teacherId } }),
    prisma.availabilityException.findMany({
      where: { teacherId, date: { gte: today, lte: addDays(today, days) } },
    }),
  ]);

  const windows: OpenWindow[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const iso = isoDate(date);
    const dayOfWeek = date.getUTCDay();
    const dayExceptions = exceptions.filter((e) => isoDate(e.date) === iso);

    if (dayExceptions.some((e) => e.type === "BLOCKED" && !e.startTime)) continue;

    const dayWindows = rules
      .filter((r) => r.dayOfWeek === dayOfWeek)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }));

    for (const e of dayExceptions) {
      if (e.type === "ADDED" && e.startTime && e.endTime) {
        dayWindows.push({ startTime: e.startTime, endTime: e.endTime });
      }
    }
    for (const e of dayExceptions) {
      if (e.type === "BLOCKED" && e.startTime && e.endTime) {
        for (let j = dayWindows.length - 1; j >= 0; j--) {
          if (e.startTime < dayWindows[j].endTime && e.endTime > dayWindows[j].startTime) {
            dayWindows.splice(j, 1);
          }
        }
      }
    }

    for (const w of dayWindows) {
      windows.push({ date: iso, startTime: w.startTime, endTime: w.endTime });
    }
  }

  return windows.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}
