import type { Locale } from "@/i18n";
import { tunisParts } from "./time";

const intlLocale = (l: Locale) => (l === "ar" ? "ar-TN-u-nu-latn" : l === "fr" ? "fr-TN" : "en-GB");

/** "18:30" in Tunis time regardless of the viewer's device timezone. */
export function fmtTime(iso: string | Date) {
  const p = tunisParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function fmtDay(iso: string | Date, l: Locale) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(intlLocale(l), { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Tunis" }).format(d);
}

export function fmtRange(start: string, end: string, l: Locale) {
  return `${fmtDay(start, l)} · ${fmtTime(start)}–${fmtTime(end)}`;
}

export function fmtMinutes(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDistance(m: number | undefined, l: Locale) {
  if (m == null) return "";
  // ~80 m per minute walking
  const min = Math.max(1, Math.round(m / 80));
  const dist = m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  return `${dist}, ${min} ${l === "ar" ? "دق" : "min"}`;
}

export function fmtNumber(n: number, l: Locale, digits = 0) {
  return new Intl.NumberFormat(intlLocale(l), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}
