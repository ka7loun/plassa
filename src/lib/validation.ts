import { z } from "zod";
import { PAYMENT_METHODS } from "./payments";
import { MAX_BOOKING_MIN } from "./pricing";

const isoDate = z.string().datetime({ offset: true });

export const searchQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().int().min(100).max(10_000).default(1500),
    start: isoDate,
    end: isoDate,
    limit: z.coerce.number().int().min(1).max(200).default(60),
  })
  .refine((q) => new Date(q.end) > new Date(q.start), { message: "end must be after start", path: ["end"] });

export const createBookingBody = z
  .object({
    spotId: z.string().uuid(),
    start: isoDate,
    end: isoDate,
    paymentMethod: z.enum(PAYMENT_METHODS as [string, ...string[]]),
    plate: z
      .string()
      .trim()
      .max(20)
      .regex(/^[\p{L}\p{N} -]*$/u, "letters, digits, spaces and dashes only")
      .optional(),
  })
  .refine((b) => new Date(b.end) > new Date(b.start), { message: "end must be after start", path: ["end"] })
  .refine((b) => (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000 <= MAX_BOOKING_MIN, {
    message: "a booking can last at most 12 hours",
    path: ["end"],
  });

export const confirmPaymentBody = z.object({
  ref: z.string().min(4).max(64),
  approved: z.boolean(),
});

export const spotBody = z
  .object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(500).default(""),
    address: z.string().trim().max(160).default(""),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    spotType: z.enum(["garage", "courtyard", "driveway", "lot", "basement"]),
    covered: z.boolean().default(false),
    privateAttested: z.literal(true, { message: "you must confirm the spot is private" }),
    gardienName: z.string().trim().max(60).optional().nullable(),
    gardienPhone: z
      .string()
      .trim()
      .regex(/^(\+216)?\s?\d{2}\s?\d{3}\s?\d{3}$/, "Tunisian phone number, e.g. +216 22 123 456")
      .optional()
      .nullable()
      .or(z.literal("")),
    photoUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
    priceMillimes: z.number().int().min(100).max(100_000),
    peakMultiplier: z.number().min(1).max(2).default(1),
    peakStartHour: z.number().int().min(0).max(23).nullable().default(null),
    peakEndHour: z.number().int().min(1).max(24).nullable().default(null),
    peakMonths: z.array(z.number().int().min(1).max(12)).max(12).default([]),
    availDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    availStartMin: z.number().int().min(0).max(1439),
    availEndMin: z.number().int().min(1).max(1440),
  })
  .refine((s) => s.availEndMin > s.availStartMin, { message: "closing time must be after opening time", path: ["availEndMin"] })
  .refine((s) => s.peakStartHour == null || s.peakEndHour == null || s.peakEndHour > s.peakStartHour, {
    message: "peak end must be after peak start",
    path: ["peakEndHour"],
  });

export const checkinBody = z.object({ code: z.string().regex(/^\d{4}$/) });

export const demoLoginBody = z.object({ role: z.enum(["driver", "host", "admin"]) });

export type SpotInput = z.infer<typeof spotBody>;
