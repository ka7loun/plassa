// Points, levels and badges. Pure functions over activity counts, so the same
// rules run in the API, the tests and (if needed) the browser.

export interface Activity {
  // as a driver
  stays: number; // completed bookings (checked in, or confirmed and ended)
  reviewsWritten: number;
  centreStays: number; // stays around Bab Bhar / the medina
  earlyStays: number; // started before 09:00
  lateStays: number; // started at 21:00 or later
  // as a host
  hostedStays: number;
  hostEarnedMillimes: number;
  spots: number;
  allDaySpots: number; // open 24 h
  ratingAvg: number | null; // average rating received on own spots
  ratingCount: number;
}

export const EMPTY_ACTIVITY: Activity = {
  stays: 0,
  reviewsWritten: 0,
  centreStays: 0,
  earlyStays: 0,
  lateStays: 0,
  hostedStays: 0,
  hostEarnedMillimes: 0,
  spots: 0,
  allDaySpots: 0,
  ratingAvg: null,
  ratingCount: 0,
};

export const POINTS = { stay: 10, review: 5, hostedStay: 15, listing: 20, fiveStarHost: 25 } as const;

export function points(a: Activity): number {
  const superHost = a.ratingAvg != null && a.ratingAvg >= 4.7 && a.ratingCount >= 5 ? POINTS.fiveStarHost : 0;
  return a.stays * POINTS.stay + a.reviewsWritten * POINTS.review + a.hostedStays * POINTS.hostedStay + a.spots * POINTS.listing + superHost;
}

export const LEVELS = [
  { key: "newcomer", min: 0 },
  { key: "regular", min: 50 },
  { key: "pro", min: 150 },
  { key: "legend", min: 400 },
] as const;
export type LevelKey = (typeof LEVELS)[number]["key"];

export function levelFor(pts: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  const progress = next ? (pts - cur.min) / (next.min - cur.min) : 1;
  return { key: cur.key as LevelKey, index: i, min: cur.min, next: next ? { key: next.key as LevelKey, min: next.min } : null, progress };
}

export type BadgeKey =
  | "first_stay"
  | "regular"
  | "medina"
  | "early_bird"
  | "night_owl"
  | "critic"
  | "first_guest"
  | "busy_host"
  | "earner"
  | "super_host"
  | "always_open";

export interface Badge {
  key: BadgeKey;
  side: "driver" | "host";
  earned: boolean;
  /** current / goal, for the progress hint */
  current: number;
  goal: number;
}

const b = (key: BadgeKey, side: Badge["side"], current: number, goal: number): Badge => ({ key, side, current: Math.min(current, goal), goal, earned: current >= goal });

export function badges(a: Activity): Badge[] {
  const superHost = a.ratingCount >= 5 && (a.ratingAvg ?? 0) >= 4.7 ? 1 : 0;
  return [
    b("first_stay", "driver", a.stays, 1),
    b("regular", "driver", a.stays, 10),
    b("medina", "driver", a.centreStays, 3),
    b("early_bird", "driver", a.earlyStays, 1),
    b("night_owl", "driver", a.lateStays, 1),
    b("critic", "driver", a.reviewsWritten, 3),
    b("first_guest", "host", a.hostedStays, 1),
    b("busy_host", "host", a.hostedStays, 20),
    b("earner", "host", Math.floor(a.hostEarnedMillimes / 1000), 100),
    b("super_host", "host", superHost, 1),
    b("always_open", "host", a.allDaySpots, 1),
  ];
}

export function profile(a: Activity) {
  const pts = points(a);
  return { points: pts, level: levelFor(pts), badges: badges(a) };
}
