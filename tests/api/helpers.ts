import type { Pool } from "pg";
import { migrate } from "../../scripts/migrate";
import { seed, spotId } from "../../db/seed";
import { DEMO_USERS, OTHER_DRIVERS, SPOTS } from "../../db/seed-data";
import { createPool } from "@/server/db";
import { fromTunisLocal, tunisDateString } from "@/lib/time";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://plassa:plassa@localhost:54329/plassa_test";

export async function freshDb(): Promise<Pool> {
  await migrate(TEST_DATABASE_URL);
  const pool = createPool(TEST_DATABASE_URL);
  await seed(pool);
  return pool;
}

/** A spot open 24/7, so tests do not depend on the weekday they run on. */
export const ALWAYS_OPEN = spotId(SPOTS.findIndex((s) => s.title === "Garage Résidence El Yasmine"));
/** Mon-Sat 08:00-21:00 spot owned by the demo host. */
export const SHOP_HOURS = spotId(SPOTS.findIndex((s) => s.title === "Garage Dar Salma"));
export const DEMO_HOST = DEMO_USERS.host.id;
export const DRIVER = DEMO_USERS.driver.id;
export const OTHER_DRIVER = OTHER_DRIVERS[0].id;
export const OTHER_HOST = "00000000-0000-4000-8000-000000000010";

/** Local Tunis time `days` from now; far enough ahead to be clear of seeded bookings. */
export function future(days: number, time: string, hours = 2) {
  const date = tunisDateString(new Date(Date.now() + days * 86_400_000));
  const start = fromTunisLocal(date, time);
  return { start, end: new Date(start.getTime() + hours * 3_600_000) };
}

/** Next date (>= minDays ahead) whose Tunis weekday is in `days`. */
export function nextWeekday(days: number[], minDays = 5) {
  for (let d = minDays; d < minDays + 8; d++) {
    const date = new Date(Date.now() + d * 86_400_000);
    const local = fromTunisLocal(tunisDateString(date), "12:00");
    if (days.includes(new Date(local.getTime() + 3_600_000).getUTCDay())) return d;
  }
  return minDays;
}
