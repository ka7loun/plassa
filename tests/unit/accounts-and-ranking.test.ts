import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { hashPassword, verifyPassword } from "@/server/password";
import { PRIOR_MEAN, rankScore, ratingAvg, sortSpots } from "@/lib/ranking";
import { badges, EMPTY_ACTIVITY, levelFor, points, POINTS, profile } from "@/lib/gamification";
import { signupBody } from "@/lib/validation";

describe("phone numbers", () => {
  it("accepts the usual ways of writing a Tunisian number", () => {
    for (const s of ["22123456", "22 123 456", "+216 22 123 456", "0021622123456", "216-22-123-456"]) expect(normalizePhone(s)).toBe("+21622123456");
  });
  it("rejects anything that is not 8 digits after the country code", () => {
    for (const s of ["2212345", "221234567", "+33 6 12 34 56 78", "abc", ""]) expect(normalizePhone(s)).toBeNull();
  });
  it("formats for display", () => {
    expect(formatPhone("+21622123456")).toBe("+216 22 123 456");
  });
  it("signup form validation matches the normaliser", () => {
    const ok = { name: "Amira", phone: "22 123 456", password: "secret123" };
    expect(signupBody.safeParse(ok).success).toBe(true);
    expect(signupBody.safeParse({ ...ok, password: "short" }).success).toBe(false);
    expect(signupBody.safeParse({ ...ok, phone: "123" }).success).toBe(false);
    expect(signupBody.safeParse({ ...ok, name: "A" }).success).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("plassa2026");
    const b = await hashPassword("plassa2026");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("plassa2026", a)).toBe(true);
    expect(await verifyPassword("plassa2027", a)).toBe(false);
    expect(await verifyPassword("plassa2026", null)).toBe(false);
    expect(await verifyPassword("plassa2026", "garbage")).toBe(false);
  });
});

describe("ranking", () => {
  it("a single 5-star review does not beat a long record of 4.8s", () => {
    expect(rankScore(5, 1)).toBeLessThan(rankScore(4.8 * 50, 50));
  });
  it("a spot without reviews sits at the prior", () => {
    expect(rankScore(0, 0)).toBe(PRIOR_MEAN);
    expect(ratingAvg(0, 0)).toBeNull();
    expect(ratingAvg(23, 5)).toBe(4.6);
  });
  it("always lists free spots before booked ones, whatever the sort", () => {
    const s = (id: string, available: boolean, distanceM: number, price: number, sum: number, count: number) => ({
      id,
      available,
      distanceM,
      priceMillimes: price,
      rating: { avg: ratingAvg(sum, count), count, score: rankScore(sum, count) },
    });
    const list = [s("busy-near", false, 50, 500, 50, 10), s("far-cheap", true, 1500, 800, 40, 10), s("near-pricey", true, 200, 3000, 45, 10)];
    expect(sortSpots(list, "distance").map((x) => x.id)).toEqual(["near-pricey", "far-cheap", "busy-near"]);
    expect(sortSpots(list, "price").map((x) => x.id)).toEqual(["far-cheap", "near-pricey", "busy-near"]);
    expect(sortSpots(list, "rating").map((x) => x.id)).toEqual(["near-pricey", "far-cheap", "busy-near"]);
    expect(sortSpots(list, "recommended").at(-1)!.id).toBe("busy-near");
  });
});

describe("gamification", () => {
  it("adds up points from both sides of the account", () => {
    const a = { ...EMPTY_ACTIVITY, stays: 3, reviewsWritten: 2, hostedStays: 4, spots: 1 };
    expect(points(a)).toBe(3 * POINTS.stay + 2 * POINTS.review + 4 * POINTS.hostedStay + POINTS.listing);
  });
  it("moves through levels and reports progress to the next one", () => {
    expect(levelFor(0)).toMatchObject({ key: "newcomer", progress: 0 });
    expect(levelFor(100)).toMatchObject({ key: "regular", next: { key: "pro", min: 150 }, progress: 0.5 });
    expect(levelFor(10_000)).toMatchObject({ key: "legend", next: null, progress: 1 });
  });
  it("awards badges only once the goal is reached", () => {
    const fresh = badges(EMPTY_ACTIVITY);
    expect(fresh.every((b) => !b.earned)).toBe(true);
    const a = { ...EMPTY_ACTIVITY, stays: 10, centreStays: 2, hostedStays: 1, ratingAvg: 4.8, ratingCount: 6 };
    const got = Object.fromEntries(badges(a).map((b) => [b.key, b]));
    expect(got.first_stay.earned && got.regular.earned && got.first_guest.earned && got.super_host.earned).toBe(true);
    expect(got.medina).toMatchObject({ earned: false, current: 2, goal: 3 });
    // a high average from too few reviews is not enough
    expect(badges({ ...a, ratingCount: 2 }).find((b) => b.key === "super_host")!.earned).toBe(false);
  });
  it("profile bundles points, level and badges", () => {
    const p = profile({ ...EMPTY_ACTIVITY, stays: 6 });
    expect(p.points).toBe(60);
    expect(p.level.key).toBe("regular");
    expect(p.badges).toHaveLength(11);
  });
});
