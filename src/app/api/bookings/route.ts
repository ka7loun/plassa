import { db } from "@/server/db";
import { createBooking, listDriverBookings } from "@/server/bookings";
import { handler, json, parseBody, rateLimit, requireRole } from "@/server/http";
import { createBookingBody } from "@/lib/validation";
import type { PaymentMethod } from "@/lib/payments";

export const GET = handler(async () => {
  const s = await requireRole("driver");
  return json({ bookings: await listDriverBookings(db(), s.userId) });
});

export const POST = handler(async (req: Request) => {
  const s = await requireRole("driver");
  rateLimit(`book:${s.userId}`, Number(process.env.BOOKING_RATE_PER_MIN ?? 30));
  const body = await parseBody(req, createBookingBody);
  const result = await createBooking(db(), s.userId, {
    spotId: body.spotId,
    start: new Date(body.start),
    end: new Date(body.end),
    paymentMethod: body.paymentMethod as PaymentMethod,
    plate: body.plate,
  });
  return json(result, 201);
});
