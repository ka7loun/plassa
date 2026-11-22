import { describe, expect, it } from "vitest";
import { generateCheckinCode, isValidCheckinCode } from "@/lib/checkin";
import { CashProvider, MockWalletProvider, providerFor } from "@/lib/payments";
import { createBookingBody, searchQuery, spotBody } from "@/lib/validation";
import { signSession, verifySession } from "@/server/auth";

describe("check-in codes", () => {
  it("are always 4 digits, zero padded", () => {
    expect(generateCheckinCode(() => 7)).toBe("0007");
    expect(generateCheckinCode(() => 9999)).toBe("9999");
    for (let i = 0; i < 200; i++) expect(isValidCheckinCode(generateCheckinCode())).toBe(true);
  });
  it("rejects malformed codes", () => {
    expect(isValidCheckinCode("123")).toBe(false);
    expect(isValidCheckinCode("12a4")).toBe(false);
  });
});

describe("payment providers", () => {
  it("routes cash to the cash provider and wallets to the gateway", () => {
    expect(providerFor("cash")).toBeInstanceOf(CashProvider);
    for (const m of ["d17", "flouci", "card"] as const) expect(providerFor(m)).toBeInstanceOf(MockWalletProvider);
  });
  it("confirms cash immediately with no redirect", async () => {
    const i = await new CashProvider().createIntent("abcdef12-0000", 3000);
    expect(i.confirmedImmediately).toBe(true);
    expect(i.redirectUrl).toBeNull();
  });
  it("sends wallet payments through an approval page", async () => {
    const w = new MockWalletProvider();
    const i = await w.createIntent("b1", 3000, "flouci");
    expect(i.redirectUrl).toMatch(/^\/pay\/b1\?ref=sim_flouci_/);
    expect(await w.confirm(i.ref, 3000, true)).toBe(true);
    expect(await w.confirm(i.ref, 3000, false)).toBe(false);
    expect(await w.confirm("forged", 3000, true)).toBe(false);
    expect((await w.refund()).refunded).toBe(true);
  });
});

describe("input validation", () => {
  const base = { spotId: "10000000-0000-4000-8000-000000000001", start: "2026-11-23T09:00:00.000Z", end: "2026-11-23T11:00:00.000Z", paymentMethod: "cash" };

  it("accepts a normal booking", () => {
    expect(createBookingBody.safeParse({ ...base, plate: "215 TU 4821" }).success).toBe(true);
  });
  it("rejects inverted, too long or unknown-method bookings", () => {
    expect(createBookingBody.safeParse({ ...base, end: base.start }).success).toBe(false);
    expect(createBookingBody.safeParse({ ...base, end: "2026-11-23T22:00:00.000Z" }).success).toBe(false); // 13h
    expect(createBookingBody.safeParse({ ...base, paymentMethod: "bitcoin" }).success).toBe(false);
    expect(createBookingBody.safeParse({ ...base, plate: "<script>" }).success).toBe(false);
  });
  it("applies search defaults and bounds", () => {
    const q = searchQuery.parse({ lat: "35.83", lng: "10.64", start: base.start, end: base.end });
    expect(q.radius).toBe(1500);
    expect(searchQuery.safeParse({ lat: "95", lng: "10", start: base.start, end: base.end }).success).toBe(false);
    expect(searchQuery.safeParse({ lat: "35", lng: "10", radius: "50000", start: base.start, end: base.end }).success).toBe(false);
  });
  it("requires hosts to attest the spot is private", () => {
    const spot = {
      title: "Garage test", lat: 35.83, lng: 10.63, spotType: "garage", priceMillimes: 1500,
      availDays: [1, 2], availStartMin: 480, availEndMin: 1200, privateAttested: true,
    };
    expect(spotBody.safeParse(spot).success).toBe(true);
    expect(spotBody.safeParse({ ...spot, privateAttested: false }).success).toBe(false);
    expect(spotBody.safeParse({ ...spot, availEndMin: 400 }).success).toBe(false);
    expect(spotBody.safeParse({ ...spot, gardienPhone: "12345" }).success).toBe(false);
    expect(spotBody.safeParse({ ...spot, gardienPhone: "+216 22 123 456" }).success).toBe(true);
  });
});

describe("sessions", () => {
  it("round-trips a signed session", async () => {
    const token = await signSession({ userId: "u1", role: "host", name: "Salma" });
    expect(await verifySession(token)).toEqual({ userId: "u1", role: "host", name: "Salma" });
  });
  it("rejects tampered or missing tokens", async () => {
    const token = await signSession({ userId: "u1", role: "driver", name: "x" });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "admin" })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
  });
});
