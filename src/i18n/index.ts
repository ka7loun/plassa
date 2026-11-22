import ar from "./ar";
import en, { type Dict } from "./en";
import fr from "./fr";

export type Locale = "fr" | "ar" | "en";
export const LOCALES: Locale[] = ["fr", "ar", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "plassa_locale";
export const DICTS: Record<Locale, Dict> = { fr, ar, en };
export const LOCALE_LABEL: Record<Locale, string> = { fr: "FR", ar: "عربي", en: "EN" };

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "ar" || v === "en";
}

export function dirOf(l: Locale) {
  return l === "ar" ? "rtl" : "ltr";
}

/** "results: {n} spots" + {n: 3} -> "results: 3 spots" */
export function fill(s: string, vars: Record<string, string | number> = {}) {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type { Dict };
