// Date helpers in UTC, matching how the app stores lesson dates (a calendar
// date at midnight UTC, plus a separate "HH:mm" start time).

const DAY = 24 * 60 * 60 * 1000;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcMidnight(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** ISO date n days from today (UTC). Negative for the past. */
export function daysFromToday(n: number): string {
  return isoDate(new Date(todayUTC().getTime() + n * DAY));
}

/**
 * The first date at least `minDaysAhead` days from today that falls on the
 * given day of week (0 = Sunday ... 6 = Saturday). Always within 7 days after
 * that, so it stays inside the app's 14-day booking window.
 */
export function nextWeekday(dayOfWeek: number, minDaysAhead = 2): string {
  for (let i = minDaysAhead; i < minDaysAhead + 7; i++) {
    const iso = daysFromToday(i);
    if (utcMidnight(iso).getUTCDay() === dayOfWeek) return iso;
  }
  throw new Error("unreachable");
}

export function dayOfWeekOf(iso: string): number {
  return utcMidnight(iso).getUTCDay();
}
