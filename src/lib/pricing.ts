import { tunisParts } from "./time";

// Money is integer millimes everywhere (1 TND = 1000 millimes) — no floats.
export const COMMISSION_RATE = 0.12; // Plassa keeps 12%, host keeps 88%
export const BILLING_STEP_MIN = 30; // billed per started half hour
export const ROUND_TO_MILLIMES = 100; // smallest coin in daily use is 100 millimes
export const MAX_BOOKING_MIN = 12 * 60;

export interface PriceRules {
  price_millimes: number; // per hour
  peak_multiplier: number;
  peak_start_hour: number | null;
  peak_end_hour: number | null;
  peak_months: number[];
}

export interface Quote {
  minutes: number;
  billedSlots: number; // half-hour slots
  peakSlots: number;
  baseMillimes: number; // before peak
  totalMillimes: number; // what the driver pays
  commissionMillimes: number;
  hostMillimes: number;
}

export function isPeak(rules: PriceRules, at: Date): boolean {
  if (rules.peak_multiplier <= 1) return false;
  if (rules.peak_start_hour == null || rules.peak_end_hour == null) return false;
  const p = tunisParts(at);
  if (rules.peak_months.length > 0 && !rules.peak_months.includes(p.month)) return false;
  return p.hour >= rules.peak_start_hour && p.hour < rules.peak_end_hour;
}

export function roundMillimes(m: number): number {
  return Math.round(m / ROUND_TO_MILLIMES) * ROUND_TO_MILLIMES;
}

export function quote(rules: PriceRules, start: Date, end: Date): Quote {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes <= 0) throw new Error("end must be after start");
  const billedSlots = Math.ceil(minutes / BILLING_STEP_MIN);
  const slotPrice = rules.price_millimes / (60 / BILLING_STEP_MIN);
  let raw = 0;
  let peakSlots = 0;
  for (let i = 0; i < billedSlots; i++) {
    const at = new Date(start.getTime() + i * BILLING_STEP_MIN * 60_000);
    if (isPeak(rules, at)) {
      peakSlots++;
      raw += slotPrice * rules.peak_multiplier;
    } else {
      raw += slotPrice;
    }
  }
  const totalMillimes = roundMillimes(raw);
  const commissionMillimes = Math.round(totalMillimes * COMMISSION_RATE);
  return {
    minutes,
    billedSlots,
    peakSlots,
    baseMillimes: roundMillimes(billedSlots * slotPrice),
    totalMillimes,
    commissionMillimes,
    hostMillimes: totalMillimes - commissionMillimes,
  };
}

/** "1.500 DT" — Tunisian dinar shown with 3 decimals. */
export function formatTND(millimes: number, locale: string = "fr"): string {
  const v = (millimes / 1000).toFixed(3);
  return locale === "ar" ? `${v} د.ت` : `${v} DT`;
}
