import { describe, expect, it } from "vitest";
import { COMMISSION_RATE, formatTND, isPeak, quote, roundMillimes, type PriceRules } from "@/lib/pricing";
import { fromTunisLocal } from "@/lib/time";

const flat: PriceRules = { price_millimes: 1500, peak_multiplier: 1, peak_start_hour: null, peak_end_hour: null, peak_months: [] };
const evening: PriceRules = { price_millimes: 2000, peak_multiplier: 1.5, peak_start_hour: 18, peak_end_hour: 21, peak_months: [] };
const summerEvening: PriceRules = { ...evening, peak_months: [6, 7, 8, 9] };

const at = (date: string, time: string) => fromTunisLocal(date, time);
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

describe("quote", () => {
  it("charges the hourly price for whole hours", () => {
    const s = at("2026-11-23", "10:00");
    const q = quote(flat, s, plus(s, 120));
    expect(q.totalMillimes).toBe(3000);
    expect(q.billedSlots).toBe(4);
    expect(q.peakSlots).toBe(0);
  });

  it("bills every started half hour", () => {
    const s = at("2026-11-23", "10:00");
    expect(quote(flat, s, plus(s, 31)).totalMillimes).toBe(1500); // 2 slots
    expect(quote(flat, s, plus(s, 45)).billedSlots).toBe(2);
    expect(quote(flat, s, plus(s, 10)).totalMillimes).toBe(800); // 750 rounded to 100 millimes
  });

  it("applies the peak multiplier only to half hours inside the window", () => {
    const s = at("2026-11-23", "17:00");
    const q = quote(evening, s, plus(s, 120)); // 17:00-19:00 -> 2 normal + 2 peak slots
    expect(q.peakSlots).toBe(2);
    expect(q.totalMillimes).toBe(1000 + 1000 + 1500 + 1500);
  });

  it("ignores seasonal peak pricing out of season", () => {
    const winter = at("2026-11-23", "19:00");
    const summer = at("2026-07-15", "19:00");
    expect(isPeak(summerEvening, winter)).toBe(false);
    expect(isPeak(summerEvening, summer)).toBe(true);
    expect(quote(summerEvening, winter, plus(winter, 60)).totalMillimes).toBe(2000);
    expect(quote(summerEvening, summer, plus(summer, 60)).totalMillimes).toBe(3000);
  });

  it("splits the total into Plassa commission and host share", () => {
    const s = at("2026-11-23", "10:00");
    const q = quote(evening, s, plus(s, 180));
    expect(q.commissionMillimes).toBe(Math.round(q.totalMillimes * COMMISSION_RATE));
    expect(q.commissionMillimes + q.hostMillimes).toBe(q.totalMillimes);
  });

  it("keeps money in integer millimes", () => {
    const s = at("2026-11-23", "18:30");
    const q = quote({ ...evening, price_millimes: 1300, peak_multiplier: 1.3 }, s, plus(s, 90));
    for (const v of [q.totalMillimes, q.commissionMillimes, q.hostMillimes]) expect(Number.isInteger(v)).toBe(true);
    expect(q.totalMillimes % 100).toBe(0);
  });

  it("rejects an empty or inverted window", () => {
    const s = at("2026-11-23", "10:00");
    expect(() => quote(flat, s, s)).toThrow();
    expect(() => quote(flat, s, plus(s, -30))).toThrow();
  });
});

describe("money helpers", () => {
  it("rounds to the nearest 100 millimes", () => {
    expect(roundMillimes(749)).toBe(700);
    expect(roundMillimes(750)).toBe(800);
  });
  it("formats Tunisian dinars with three decimals", () => {
    expect(formatTND(1500)).toBe("1.500 DT");
    expect(formatTND(12000, "fr")).toBe("12.000 DT");
    expect(formatTND(1500, "ar")).toBe("1.500 د.ت");
  });
});
