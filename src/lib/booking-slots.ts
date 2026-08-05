import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
export const HOLD_EXPIRY_MINUTES = 10;

export type Slot = { date: string; startTime: string; endTime: string };
type Range = { startTime: string; endTime: string };

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

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// UK-only MVP (no per-user timezone conversion, per data-model.md) — but
// the server itself might not run in Europe/London, so "now" still needs
// converting to UK wall-clock time to correctly drop today's past slots
// across the GMT/BST boundary.
function nowInUK(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

// Carves `block` out of each window in `ranges`, splitting a window into
// up to two pieces if the block falls in the middle — unlike the coarser
// getUpcomingAvailability (used for previews/filters), this needs to be
// precise enough to actually sell a slot.
function subtractRange(ranges: Range[], block: Range): Range[] {
  const result: Range[] = [];
  for (const r of ranges) {
    if (block.endTime <= r.startTime || block.startTime >= r.endTime) {
      result.push(r);
      continue;
    }
    if (block.startTime > r.startTime) result.push({ startTime: r.startTime, endTime: block.startTime });
    if (block.endTime < r.endTime) result.push({ startTime: block.endTime, endTime: r.endTime });
  }
  return result;
}

function chunk(range: Range, durationMinutes: number): Range[] {
  const slots: Range[] = [];
  let cursor = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  while (cursor + durationMinutes <= end) {
    slots.push({ startTime: fromMinutes(cursor), endTime: fromMinutes(cursor + durationMinutes) });
    cursor += durationMinutes;
  }
  return slots;
}

// Bookable slots for the next `days` days: weekly rules, with exceptions
// applied (BLOCKED carves time out, ADDED opens extra windows), minus
// time already occupied by other non-cancelled, non-expired bookings,
// chunked into `durationMinutes` pieces. Today's already-past slots are
// dropped.
export async function getBookableSlots(
  teacherId: string,
  durationMinutes: number,
  days = 14
): Promise<Slot[]> {
  const today = startOfTodayUTC();
  const rangeEnd = addDays(today, days);
  const holdCutoff = new Date(Date.now() - HOLD_EXPIRY_MINUTES * 60_000);

  const [rules, exceptions, bookings] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { teacherId } }),
    prisma.availabilityException.findMany({
      where: { teacherId, date: { gte: today, lte: rangeEnd } },
    }),
    prisma.booking.findMany({
      where: {
        teacherId,
        lessonDate: { gte: today, lte: rangeEnd },
        OR: [
          { status: { in: ["CONFIRMED", "COMPLETED"] } },
          { status: "PENDING_PAYMENT", createdAt: { gte: holdCutoff } },
        ],
      },
      select: { lessonDate: true, startTime: true, durationMinutes: true },
    }),
  ]);

  const { date: todayIso, time: nowTime } = nowInUK();
  const slots: Slot[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const iso = isoDate(date);
    const dayOfWeek = date.getUTCDay();
    const dayExceptions = exceptions.filter((e) => isoDate(e.date) === iso);

    if (dayExceptions.some((e) => e.type === "BLOCKED" && !e.startTime)) continue;

    let windows: Range[] = rules
      .filter((r) => r.dayOfWeek === dayOfWeek)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }));

    for (const e of dayExceptions) {
      if (e.type === "ADDED" && e.startTime && e.endTime) {
        windows.push({ startTime: e.startTime, endTime: e.endTime });
      }
    }
    for (const e of dayExceptions) {
      if (e.type === "BLOCKED" && e.startTime && e.endTime) {
        windows = subtractRange(windows, { startTime: e.startTime, endTime: e.endTime });
      }
    }

    for (const b of bookings.filter((b) => isoDate(b.lessonDate) === iso)) {
      const blockEnd = fromMinutes(toMinutes(b.startTime) + b.durationMinutes);
      windows = subtractRange(windows, { startTime: b.startTime, endTime: blockEnd });
    }

    for (const w of windows) {
      for (const s of chunk(w, durationMinutes)) {
        if (iso === todayIso && s.startTime <= nowTime) continue;
        slots.push({ date: iso, startTime: s.startTime, endTime: s.endTime });
      }
    }
  }

  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}
