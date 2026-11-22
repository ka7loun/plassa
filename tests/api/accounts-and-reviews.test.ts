import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBooking, createReview } from "@/server/bookings";
import { driverDashboard, hostDashboard, hostLeaderboard } from "@/server/dashboard";
import { AppError } from "@/server/errors";
import { createSpot, getSpot, patchSpot, topSpots } from "@/server/spots";
import { login, signup } from "@/server/users";
import { rankScore } from "@/lib/ranking";
import { loadPhoto, MAX_PHOTO_BYTES, savePhoto, sniffImage } from "@/server/photos";
import { readFileSync } from "node:fs";
import { spotId } from "../../db/seed";
import { DEMO_PASSWORD, DEMO_USERS, SPOTS } from "../../db/seed-data";
import { ALWAYS_OPEN, DEMO_HOST, DRIVER, freshDb, future, OTHER_DRIVER } from "./helpers";

let pool: Pool;
beforeAll(async () => {
  pool = await freshDb();
});
afterAll(async () => {
  await pool?.end();
});

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

const YASSINE_SPOT = spotId(SPOTS.findIndex((s) => s.title === "Allée de Yassine"));

/** A finished stay: booked "in the past" by passing an earlier clock to createBooking. */
async function pastStay(driver: string, daysAgo: number, hour: number, spot = ALWAYS_OPEN) {
  const start = new Date(Date.now() - daysAgo * 86_400_000);
  start.setUTCHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 3_600_000);
  const r = await createBooking(pool, driver, { spotId: spot, start, end, paymentMethod: "cash" }, new Date(start.getTime() - 3_600_000));
  return r.booking;
}

describe("accounts", () => {
  it("signs up with a phone number and logs in with it, in any format", async () => {
    const u = await signup(pool, { name: "Amira Ben Ali", phone: "29 555 111", password: "jasmin-2026" });
    expect(u).toMatchObject({ role: "user", name: "Amira Ben Ali", phone: "+21629555111" });
    const again = await login(pool, { phone: "+216 29 555 111", password: "jasmin-2026" });
    expect(again.id).toBe(u.id);
  });

  it("refuses a second account on the same phone number", async () => {
    expect(await code(signup(pool, { name: "Someone", phone: "0021629555111", password: "another-pass" }))).toBe("phone_taken");
  });

  it("gives the same answer for an unknown phone and a wrong password", async () => {
    expect(await code(login(pool, { phone: "29 555 111", password: "wrong-pass" }))).toBe("bad_credentials");
    expect(await code(login(pool, { phone: "98 000 000", password: "jasmin-2026" }))).toBe("bad_credentials");
  });

  it("demo accounts have a password too", async () => {
    const u = await login(pool, { phone: DEMO_USERS.driver.phone!, password: DEMO_PASSWORD });
    expect(u.id).toBe(DRIVER);
  });

  it("one account can rent out a spot and book other spots", async () => {
    const u = await signup(pool, { name: "Karim", phone: "50 123 789", password: "karim-2026" });
    const spot = await createSpot(pool, u.id, {
      title: "Garage de Karim",
      description: "",
      address: "Sahloul",
      lat: 35.837,
      lng: 10.594,
      spotType: "garage",
      covered: true,
      privateAttested: true,
      gardienName: null,
      gardienPhone: null,
      photos: ["/spots/garage-1.jpg"],
      paymentMethods: ["cash"],
      priceMillimes: 1000,
      peakMultiplier: 1,
      peakStartHour: null,
      peakEndHour: null,
      peakMonths: [],
      availDays: [0, 1, 2, 3, 4, 5, 6],
      availStartMin: 0,
      availEndMin: 1440,
    });
    expect(spot.photos).toEqual(["/spots/garage-1.jpg"]);
    const w = future(8, "09:00", 1);
    expect((await createBooking(pool, u.id, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" })).booking.status).toBe("confirmed");
    // ...but not their own spot
    expect(await code(createBooking(pool, u.id, { spotId: spot.id, ...w, paymentMethod: "cash" }))).toBe("own_spot");
  });
});

describe("payment methods chosen by the host", () => {
  it("only accepts the methods the host ticked", async () => {
    const w = future(9, "10:00", 1);
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: YASSINE_SPOT, ...w, paymentMethod: "card" }))).toBe("method_not_accepted");
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: YASSINE_SPOT, ...w, paymentMethod: "d17" }))).toBe("ok");
  });

  it("the host can change them, but must keep at least one", async () => {
    const s = await patchSpot(pool, DRIVER, YASSINE_SPOT, { paymentMethods: ["flouci"] });
    expect(s.paymentMethods).toEqual(["flouci"]);
    const w = future(9, "14:00", 1);
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: YASSINE_SPOT, ...w, paymentMethod: "cash" }))).toBe("method_not_accepted");
    // the database refuses an empty list even if a caller skips validation
    await expect(pool.query("update spots set payment_methods = '{}' where id = $1", [YASSINE_SPOT])).rejects.toThrow();
  });

  it("another account cannot change them", async () => {
    expect(await code(patchSpot(pool, OTHER_DRIVER, YASSINE_SPOT, { paymentMethods: ["cash"] }))).toBe("forbidden");
  });
});

describe("reviews", () => {
  it("can only rate a stay once it is over, once, and only your own", async () => {
    const upcoming = (await createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...future(12, "15:00", 1), paymentMethod: "cash" })).booking;
    expect(await code(createReview(pool, OTHER_DRIVER, upcoming.id, { rating: 5, comment: "" }))).toBe("not_reviewable");

    const stay = await pastStay(OTHER_DRIVER, 35, 2);
    expect(await code(createReview(pool, DRIVER, stay.id, { rating: 1, comment: "" }))).toBe("forbidden");
    expect(await code(createReview(pool, OTHER_DRIVER, stay.id, { rating: 4, comment: "Mriguel" }))).toBe("ok");
    expect(await code(createReview(pool, OTHER_DRIVER, stay.id, { rating: 5, comment: "" }))).toBe("already_reviewed");
  });

  it("keeps the spot's rating totals in step with the reviews", async () => {
    const before = await getSpot(pool, ALWAYS_OPEN);
    const stay = await pastStay(OTHER_DRIVER, 36, 2);
    await createReview(pool, OTHER_DRIVER, stay.id, { rating: 5, comment: "" });
    const after = await getSpot(pool, ALWAYS_OPEN);
    expect(after.rating.count).toBe(before.rating.count + 1);
    const { rows } = await pool.query<{ n: number; s: number }>("select count(*)::int as n, sum(rating)::int as s from reviews where spot_id = $1", [ALWAYS_OPEN]);
    expect(after.rating.count).toBe(rows[0].n);
    expect(after.rating.score).toBeCloseTo(rankScore(rows[0].s, rows[0].n), 6);
  });
});

describe("dashboards and rankings", () => {
  it("a new account starts at zero, as newcomer, with no badges", async () => {
    const u = await signup(pool, { name: "Nour", phone: "55 000 777", password: "nour-2026" });
    const d = await driverDashboard(pool, u.id);
    expect(d).toMatchObject({ stays: 0, spentMillimes: 0, points: 0, hostSpots: 0 });
    expect(d.level.key).toBe("newcomer");
    expect(d.badges.some((b) => b.earned)).toBe(false);
    const h = await hostDashboard(pool, u.id);
    expect(h.rank).toBeNull();
    expect(h.weeks).toHaveLength(8);
  });

  it("the demo driver has stays to show, and stays waiting for a rating", async () => {
    const d = await driverDashboard(pool, DRIVER);
    expect(d.stays).toBeGreaterThan(5);
    expect(d.points).toBeGreaterThanOrEqual(d.stays * 10);
    expect(d.toReview.length).toBeGreaterThan(0);
    expect(d.badges.find((b) => b.key === "first_stay")!.earned).toBe(true);
  });

  it("the demo host earns, is rated and ranked among hosts", async () => {
    const h = await hostDashboard(pool, DEMO_HOST);
    expect(h.hostedStays).toBeGreaterThan(10);
    expect(h.rating.count).toBeGreaterThan(0);
    expect(h.rank!.position).toBeGreaterThanOrEqual(1);
    expect(h.rank!.position).toBeLessThanOrEqual(h.rank!.of);
    expect(h.weeks.reduce((a, w) => a + w.earnedMillimes, 0)).toBeGreaterThan(0);
  });

  it("top spots are ordered by the Bayesian score, the leaderboard by stays", async () => {
    const top = await topSpots(pool, 10);
    expect(top.length).toBe(10);
    const scores = top.map((s) => s.rating.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const leaders = await hostLeaderboard(pool, 5);
    const stays = leaders.map((l) => l.stays);
    expect([...stays].sort((a, b) => b - a)).toEqual(stays);
  });
});

describe("photo uploads", () => {
  const jpeg = new Uint8Array(readFileSync("public/spots/garage-1-sm.jpg"));

  it("stores a real JPEG and serves it back byte for byte", async () => {
    expect(sniffImage(jpeg)).toBe("image/jpeg");
    const saved = await savePhoto(pool, DEMO_HOST, jpeg);
    expect(saved.url).toBe(`/api/photos/${saved.id}`);
    const back = await loadPhoto(pool, saved.id);
    expect(back.content_type).toBe("image/jpeg");
    expect(Buffer.compare(back.data, Buffer.from(jpeg))).toBe(0);
  });

  it("refuses files that are not images, even when renamed", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(await code(savePhoto(pool, DEMO_HOST, html))).toBe("bad_request");
    expect(await code(savePhoto(pool, DEMO_HOST, new Uint8Array()))).toBe("bad_request");
  });

  it("refuses photos over 1.5 MB", async () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(jpeg.subarray(0, 3));
    expect(await code(savePhoto(pool, DEMO_HOST, big))).toBe("too_large");
  });

  it("only accepts photo paths the app itself produced", async () => {
    const { spotBody } = await import("@/lib/validation");
    const base = { title: "Garage", description: "", address: "", lat: 35.83, lng: 10.63, spotType: "garage", covered: false, privateAttested: true, gardienName: null, gardienPhone: null, paymentMethods: ["cash"], priceMillimes: 1000, peakMultiplier: 1, peakStartHour: null, peakEndHour: null, peakMonths: [], availDays: [1], availStartMin: 480, availEndMin: 1080 };
    expect(spotBody.safeParse({ ...base, photos: ["/spots/garage-1.jpg", "/api/photos/0b9a3c1e-2f4d-4c6a-9e8b-1a2b3c4d5e6f"] }).success).toBe(true);
    expect(spotBody.safeParse({ ...base, photos: ["https://evil.example/x.jpg"] }).success).toBe(false);
    expect(spotBody.safeParse({ ...base, photos: ["javascript:alert(1)"] }).success).toBe(false);
    expect(spotBody.safeParse({ ...base, photos: Array(7).fill("/spots/garage-1.jpg") }).success).toBe(false);
  });
});
