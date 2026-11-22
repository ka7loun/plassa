import { db } from "@/server/db";
import { listHostBookings } from "@/server/bookings";
import { handler, json, requireRole } from "@/server/http";

export const GET = handler(async () => {
  const s = await requireRole("host");
  return json({ bookings: await listHostBookings(db(), s.userId) });
});
