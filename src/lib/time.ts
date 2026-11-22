// Tunisia is UTC+1 all year (no DST since 2009). We keep that fixed offset
// instead of shipping a timezone database: simple, deterministic and testable.
export const TUNIS_OFFSET_MIN = 60;

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0=Sun..6=Sat
  hour: number;
  minute: number;
  minuteOfDay: number;
}

/** Wall-clock parts of an instant in Tunis local time. */
export function tunisParts(d: Date): LocalParts {
  const s = new Date(d.getTime() + TUNIS_OFFSET_MIN * 60_000);
  const hour = s.getUTCHours();
  const minute = s.getUTCMinutes();
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    weekday: s.getUTCDay(),
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Instant for a Tunis local date + time ("2026-11-22", "18:30"). */
export function fromTunisLocal(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - TUNIS_OFFSET_MIN * 60_000);
}

/** "YYYY-MM-DD" in Tunis local time. */
export function tunisDateString(d: Date): string {
  const p = tunisParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:MM" in Tunis local time. */
export function tunisTimeString(d: Date): string {
  const p = tunisParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Next half-hour boundary at or after `d` (used as a default arrival time). */
export function nextHalfHour(d: Date): Date {
  const step = 30 * 60_000;
  return new Date(Math.ceil(d.getTime() / step) * step);
}

/**
 * A sensible default arrival: the next half hour during the day, otherwise
 * 10:00 (most private spots are closed at night).
 */
export function suggestedStart(now = new Date()): Date {
  const h = tunisParts(now).hour;
  if (h >= 8 && h < 21) return nextHalfHour(now);
  const day = tunisDateString(new Date(now.getTime() + (h >= 21 ? 86_400_000 : 0)));
  return fromTunisLocal(day, "10:00");
}

export interface Availability {
  avail_days: number[];
  avail_start_min: number;
  avail_end_min: number;
}

/**
 * True when [start, end) fits inside the spot's weekly window. A booking must
 * start and end on the same local day, inside that day's opening window.
 * (A 24h window, 0-1440, also allows bookings that end exactly at midnight.)
 */
export function fitsAvailability(a: Availability, start: Date, end: Date): boolean {
  if (end <= start) return false;
  const s = tunisParts(start);
  const durationMin = (end.getTime() - start.getTime()) / 60_000;
  const endMinOfDay = s.minuteOfDay + durationMin;
  if (!a.avail_days.includes(s.weekday)) return false;
  if (s.minuteOfDay < a.avail_start_min) return false;
  if (endMinOfDay > a.avail_end_min) return false;
  return true;
}
