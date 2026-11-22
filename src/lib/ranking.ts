// Spot ranking. A plain average lets one 5-star review beat fifty 4.8s, so we
// use a Bayesian average: every spot starts with PRIOR_WEIGHT imaginary
// reviews at PRIOR_MEAN, and real reviews pull it from there.
export const PRIOR_MEAN = 4.0;
export const PRIOR_WEIGHT = 5;

export function ratingAvg(sum: number, count: number): number | null {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

export function rankScore(sum: number, count: number): number {
  return (PRIOR_WEIGHT * PRIOR_MEAN + sum) / (PRIOR_WEIGHT + count);
}

export type SortKey = "recommended" | "distance" | "price" | "rating";

export interface Rankable {
  available?: boolean;
  distanceM?: number;
  priceMillimes: number;
  quote?: { totalMillimes: number };
  rating: { avg: number | null; count: number; score: number };
}

/**
 * "recommended": free spots first, then a blend of quality and walking
 * distance (each 500 m costs about as much as 0.25 stars).
 */
export function sortSpots<T extends Rankable>(spots: T[], sort: SortKey): T[] {
  const price = (s: T) => s.quote?.totalMillimes ?? s.priceMillimes;
  const dist = (s: T) => s.distanceM ?? 0;
  const by: Record<SortKey, (a: T, b: T) => number> = {
    recommended: (a, b) => b.rating.score - dist(b) / 2000 - (a.rating.score - dist(a) / 2000),
    distance: (a, b) => dist(a) - dist(b),
    price: (a, b) => price(a) - price(b) || dist(a) - dist(b),
    rating: (a, b) => b.rating.score - a.rating.score || dist(a) - dist(b),
  };
  return [...spots].sort((a, b) => Number(b.available ?? true) - Number(a.available ?? true) || by[sort](a, b));
}
