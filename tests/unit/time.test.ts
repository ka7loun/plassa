import { describe, expect, it } from "vitest";
import { fitsAvailability, fromTunisLocal, nextHalfHour, suggestedStart, tunisDateString, tunisParts, tunisTimeString } from "@/lib/time";

describe("Tunis time (UTC+1, no DST)", () => {
  it("converts local wall time to UTC and back", () => {
    const d = fromTunisLocal("2026-07-15", "18:30");
    expect(d.toISOString()).toBe("2026-07-15T17:30:00.000Z"); // no summer time in Tunisia
    expect(tunisTimeString(d)).toBe("18:30");
    expect(tunisDateString(d)).toBe("2026-07-15");
  });

  it("handles the day boundary", () => {
    const d = new Date("2026-11-22T23:30:00Z"); // 00:30 on the 23rd in Tunis
    const p = tunisParts(d);
    expect(p.day).toBe(23);
    expect(p.hour).toBe(0);
    expect(p.weekday).toBe(1); // Monday
  });

  it("rounds up to the next half hour", () => {
    expect(nextHalfHour(new Date("2026-11-22T10:01:00Z")).toISOString()).toBe("2026-11-22T10:30:00.000Z");
    expect(nextHalfHour(new Date("2026-11-22T10:30:00Z")).toISOString()).toBe("2026-11-22T10:30:00.000Z");
  });

  it("suggests 10:00 at night and the next half hour by day", () => {
    expect(tunisTimeString(suggestedStart(fromTunisLocal("2026-11-22", "03:40")))).toBe("10:00");
    const late = suggestedStart(fromTunisLocal("2026-11-22", "22:15"));
    expect(tunisDateString(late)).toBe("2026-11-23");
    expect(tunisTimeString(suggestedStart(fromTunisLocal("2026-11-22", "14:10")))).toBe("14:30");
  });
});

describe("fitsAvailability", () => {
  const shop = { avail_days: [1, 2, 3, 4, 5, 6], avail_start_min: 8 * 60, avail_end_min: 21 * 60 }; // Mon-Sat 08-21
  const allDay = { avail_days: [0, 1, 2, 3, 4, 5, 6], avail_start_min: 0, avail_end_min: 1440 };

  it("accepts a window inside opening hours", () => {
    expect(fitsAvailability(shop, fromTunisLocal("2026-11-23", "10:00"), fromTunisLocal("2026-11-23", "12:00"))).toBe(true);
    expect(fitsAvailability(shop, fromTunisLocal("2026-11-23", "19:00"), fromTunisLocal("2026-11-23", "21:00"))).toBe(true);
  });

  it("rejects closed days and hours", () => {
    expect(fitsAvailability(shop, fromTunisLocal("2026-11-22", "10:00"), fromTunisLocal("2026-11-22", "11:00"))).toBe(false); // Sunday
    expect(fitsAvailability(shop, fromTunisLocal("2026-11-23", "07:30"), fromTunisLocal("2026-11-23", "09:00"))).toBe(false);
    expect(fitsAvailability(shop, fromTunisLocal("2026-11-23", "20:00"), fromTunisLocal("2026-11-23", "21:30"))).toBe(false);
  });

  it("allows a 24h spot until midnight but not across it", () => {
    expect(fitsAvailability(allDay, fromTunisLocal("2026-11-23", "22:00"), fromTunisLocal("2026-11-24", "00:00"))).toBe(true);
    expect(fitsAvailability(allDay, fromTunisLocal("2026-11-23", "23:00"), fromTunisLocal("2026-11-24", "01:00"))).toBe(false);
  });

  it("rejects an inverted window", () => {
    expect(fitsAvailability(allDay, fromTunisLocal("2026-11-23", "12:00"), fromTunisLocal("2026-11-23", "11:00"))).toBe(false);
  });
});
