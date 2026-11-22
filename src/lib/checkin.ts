import { randomInt } from "node:crypto";

/** 4-digit code the driver shows to the host or gardien on arrival. */
export function generateCheckinCode(rand: (max: number) => number = randomInt): string {
  return String(rand(10_000)).padStart(4, "0");
}

export function isValidCheckinCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
