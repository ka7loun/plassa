import { db } from "@/server/db";
import { listHostBookings } from "@/server/bookings";
import { handler, json, requireUser } from "@/server/http";

export const GET = handler(async () => {
  const s = await requireUser();
  return json({ bookings: await listHostBookings(db(), s.userId) });
});
