import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelBooking, checkIn, confirmPayment, createBooking, getDriverBooking, hostSummary, listHostBookings } from "@/server/bookings";
import { AppError } from "@/server/errors";
import { searchSpots } from "@/server/spots";
import { ALWAYS_OPEN, DEMO_HOST, DRIVER, freshDb, future, nextWeekday, OTHER_DRIVER, OTHER_HOST, SHOP_HOURS } from "./helpers";

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

describe("booking a spot", () => {
  it("confirms a cash booking immediately with a check-in code and the right price", async () => {
    const w = future(6, "10:00", 2);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash", plate: "215 tu 4821" });
    expect(r.booking.status).toBe("confirmed");
    expect(r.booking.checkinCode).toMatch(/^\d{4}$/);
    expect(r.booking.plate).toBe("215 TU 4821");
    expect(r.booking.amountMillimes).toBe(4000); // 2.000 DT/h x 2h
    expect(r.redirectUrl).toBeNull();
  });

  it("refuses an overlapping booking of the same spot (slot_taken)", async () => {
    const w = future(6, "11:00", 2); // overlaps 10:00-12:00 above
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("slot_taken");
  });

  it("allows back-to-back bookings (end is exclusive)", async () => {
    const w = future(6, "12:00", 1);
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("ok");
  });

  it("refuses bookings outside opening hours or in the past", async () => {
    const sunday = nextWeekday([0]);
    expect(await code(createBooking(pool, DRIVER, { spotId: SHOP_HOURS, ...future(sunday, "10:00"), paymentMethod: "cash" }))).toBe("outside_availability");
    const past = { start: new Date(Date.now() - 3 * 3_600_000), end: new Date(Date.now() - 3_600_000) };
    expect(await code(createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...past, paymentMethod: "cash" }))).toBe("in_the_past");
  });

  it("returns not_found for an unknown spot", async () => {
    expect(await code(createBooking(pool, DRIVER, { spotId: "10000000-0000-4000-8000-999999999999", ...future(6, "15:00"), paymentMethod: "cash" }))).toBe("not_found");
  });
});

describe("wallet payments (simulated D17 / Flouci / card)", () => {
  it("holds the slot while pending, then confirms on approval", async () => {
    const w = future(7, "09:00", 1);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "flouci" });
    expect(r.booking.status).toBe("pending_payment");
    expect(r.redirectUrl).toContain(`/pay/${r.booking.id}`);
    // the pending hold already blocks the slot
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("slot_taken");
    const ok = await confirmPayment(pool, DRIVER, r.booking.id, r.booking.paymentRef!, true);
    expect(ok.status).toBe("confirmed");
    // idempotent
    expect((await confirmPayment(pool, DRIVER, r.booking.id, r.booking.paymentRef!, true)).status).toBe("confirmed");
  });

  it("releases the slot when the payment is declined", async () => {
    const w = future(7, "13:00", 1);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "d17" });
    expect(await code(confirmPayment(pool, DRIVER, r.booking.id, r.booking.paymentRef!, false))).toBe("payment_failed");
    expect((await getDriverBooking(pool, DRIVER, r.booking.id)).status).toBe("cancelled");
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("ok");
  });

  it("rejects a forged payment reference", async () => {
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...future(7, "16:00", 1), paymentMethod: "card" });
    expect(await code(confirmPayment(pool, DRIVER, r.booking.id, "sim_card_forged", true))).toBe("bad_request");
  });

  it("frees an abandoned checkout after 15 minutes", async () => {
    const w = future(7, "18:00", 1);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "flouci" });
    await pool.query("update bookings set created_at = now() - interval '20 minutes' where id = $1", [r.booking.id]);
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("ok");
    const { rows } = await pool.query("select status from bookings where id = $1", [r.booking.id]);
    expect(rows[0].status).toBe("expired");
  });
});

describe("cancelling and checking in", () => {
  it("lets the driver cancel a future booking, which frees the slot", async () => {
    const w = future(8, "10:00", 2);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" });
    const c = await cancelBooking(pool, DRIVER, r.booking.id);
    expect(c.booking.status).toBe("cancelled");
    expect(c.refunded).toBe(false); // cash: nothing was charged
    expect(await code(createBooking(pool, OTHER_DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" }))).toBe("ok");
  });

  it("does not let another driver read or cancel the booking", async () => {
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...future(8, "14:00", 1), paymentMethod: "cash" });
    expect(await code(cancelBooking(pool, OTHER_DRIVER, r.booking.id))).toBe("forbidden");
    expect(await code(getDriverBooking(pool, OTHER_DRIVER, r.booking.id))).toBe("forbidden");
  });

  it("checks a driver in with the 4-digit code, only for the spot's host and only near the slot", async () => {
    const w = future(9, "10:00", 2);
    const r = await createBooking(pool, DRIVER, { spotId: ALWAYS_OPEN, ...w, paymentMethod: "cash" });
    const code4 = r.booking.checkinCode!;
    expect(await code(checkIn(pool, DEMO_HOST, code4, new Date(w.start.getTime() - 3 * 3_600_000)))).toBe("not_found"); // too early
    expect(await code(checkIn(pool, OTHER_HOST, code4, w.start))).toBe("not_found"); // not their spot
    const b = await checkIn(pool, DEMO_HOST, code4, new Date(w.start.getTime() + 5 * 60_000));
    expect(b.status).toBe("checked_in");
    expect(b.checkinCode).toBeUndefined(); // hosts never receive codes
  });

  it("shows the host upcoming bookings without check-in codes, and earnings", async () => {
    const list = await listHostBookings(pool, DEMO_HOST);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((b) => b.checkinCode === undefined)).toBe(true);
    const s = await hostSummary(pool, DEMO_HOST);
    expect(s.activeSpots).toBeGreaterThan(0);
    expect(s.monthHostMillimes).toBeGreaterThanOrEqual(0);
  });
});

describe("search", () => {
  it("returns spots by distance and marks booked ones unavailable", async () => {
    const w = future(6, "10:30", 1); // inside the first booking above
    const spots = await searchSpots(pool, { lat: 35.8346, lng: 10.6312, radius: 1500, ...w, limit: 50 }, { log: false });
    expect(spots.length).toBeGreaterThan(3);
    const d = spots.map((s) => s.distanceM!);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(d.every((x) => x <= 1500)).toBe(true);
    const target = spots.find((s) => s.id === ALWAYS_OPEN)!;
    expect(target.available).toBe(false);
    expect(target.unavailableReason).toBe("booked");
  });

  it("respects the radius", async () => {
    const w = future(6, "10:30", 1);
    const near = await searchSpots(pool, { lat: 35.8287, lng: 10.6375, radius: 300, ...w, limit: 50 }, { log: false });
    const wide = await searchSpots(pool, { lat: 35.8287, lng: 10.6375, radius: 3000, ...w, limit: 50 }, { log: false });
    expect(near.length).toBeLessThan(wide.length);
    expect(near.every((s) => s.distanceM! <= 300)).toBe(true);
  });
});
