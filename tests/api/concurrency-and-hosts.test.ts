import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cityStats } from "@/server/admin";
import { createBooking } from "@/server/bookings";
import { AppError } from "@/server/errors";
import { createSpot, searchSpots, setSpotActive, updateSpot } from "@/server/spots";
import { DEMO_HOST, freshDb, future, OTHER_HOST } from "./helpers";
import { OTHER_DRIVERS } from "../../db/seed-data";

let pool: Pool;
beforeAll(async () => {
  pool = await freshDb();
});
afterAll(async () => {
  await pool?.end();
});

const newSpot = {
  title: "Garage test Bab Bhar",
  description: "",
  address: "Rue de test",
  lat: 35.8289,
  lng: 10.6369,
  spotType: "garage" as const,
  covered: true,
  privateAttested: true as const,
  gardienName: null,
  gardienPhone: null,
  photoUrl: null,
  priceMillimes: 1500,
  peakMultiplier: 1,
  peakStartHour: null,
  peakEndHour: null,
  peakMonths: [],
  availDays: [0, 1, 2, 3, 4, 5, 6],
  availStartMin: 0,
  availEndMin: 1440,
};

describe("concurrency", () => {
  it("50 drivers racing for the same slot: exactly one wins", async () => {
    const spot = await createSpot(pool, DEMO_HOST, { ...newSpot, title: "Race spot" });
    const w = future(10, "18:00", 2);
    const drivers = Array.from({ length: 50 }, (_, i) => OTHER_DRIVERS[i % OTHER_DRIVERS.length].id);
    const t0 = performance.now();
    const results = await Promise.allSettled(drivers.map((d) => createBooking(pool, d, { spotId: spot.id, ...w, paymentMethod: "cash" })));
    const ms = performance.now() - t0;
    const won = results.filter((r) => r.status === "fulfilled").length;
    const taken = results.filter((r) => r.status === "rejected" && r.reason instanceof AppError && r.reason.code === "slot_taken").length;
    console.log(`[concurrency] 50 parallel bookings -> ${won} confirmed, ${taken} slot_taken in ${ms.toFixed(0)} ms`);
    expect(won).toBe(1);
    expect(taken).toBe(49);
    const { rows } = await pool.query("select count(*)::int as n from bookings where spot_id = $1 and status = 'confirmed'", [spot.id]);
    expect(rows[0].n).toBe(1);
  });

  it("24 parallel bookings of different slots on one spot: all succeed", async () => {
    const spot = await createSpot(pool, DEMO_HOST, { ...newSpot, title: "Busy spot" });
    const day = future(11, "00:00", 0.5).start;
    const results = await Promise.allSettled(
      Array.from({ length: 24 }, (_, i) => {
        const start = new Date(day.getTime() + i * 3_600_000);
        return createBooking(pool, OTHER_DRIVERS[i % OTHER_DRIVERS.length].id, { spotId: spot.id, start, end: new Date(start.getTime() + 30 * 60_000), paymentMethod: "cash" });
      }),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});

describe("hosts", () => {
  it("a new listing is attached to the nearest zone and shows up in driver search", async () => {
    const spot = await createSpot(pool, DEMO_HOST, { ...newSpot, title: "Fresh listing" });
    expect(spot.cityId).toBe("sousse");
    expect(spot.zoneId).toBe("sousse-babbhar");
    const found = await searchSpots(pool, { lat: 35.8287, lng: 10.6375, radius: 500, ...future(12, "10:00"), limit: 100 }, { log: false });
    expect(found.some((s) => s.id === spot.id && s.available)).toBe(true);
  });

  it("a host cannot edit or pause another host's spot", async () => {
    const spot = await createSpot(pool, DEMO_HOST, { ...newSpot, title: "Mine" });
    await expect(updateSpot(pool, OTHER_HOST, spot.id, { ...newSpot, title: "Hijacked" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(setSpotActive(pool, OTHER_HOST, spot.id, false)).rejects.toMatchObject({ code: "forbidden" });
    const own = await updateSpot(pool, DEMO_HOST, spot.id, { ...newSpot, title: "Mine, renamed" });
    expect(own.title).toBe("Mine, renamed");
  });

  it("paused spots disappear from search", async () => {
    const spot = await createSpot(pool, DEMO_HOST, { ...newSpot, title: "Paused" });
    await setSpotActive(pool, DEMO_HOST, spot.id, false);
    const found = await searchSpots(pool, { lat: 35.8287, lng: 10.6375, radius: 500, ...future(12, "10:00"), limit: 100 }, { log: false });
    expect(found.some((s) => s.id === spot.id)).toBe(false);
  });
});

describe("city view", () => {
  it("aggregates bookings, supply and demand per zone", async () => {
    const s = await cityStats(pool, "sousse");
    expect(s.totals.activeSpots).toBeGreaterThan(20);
    expect(s.totals.bookings).toBeGreaterThan(10);
    expect(s.totals.searches).toBeGreaterThan(100);
    expect(s.zones.length).toBe(6);
    // sorted by pressure (searches per spot per day), descending
    const p = s.zones.map((z) => z.pressure);
    expect([...p].sort((a, b) => b - a)).toEqual(p);
    expect(s.hourly).toHaveLength(24);
    expect(s.totals.circlingMinutesSaved).toBe(s.totals.bookings * s.totals.assumedCirclingMinPerBooking);
  });

  it("keeps cities separate", async () => {
    const m = await cityStats(pool, "monastir");
    expect(m.zones.map((z) => z.id)).toEqual(["monastir-centre"]);
    expect(m.totals.activeSpots).toBe(3);
  });
});
