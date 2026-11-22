import { db } from "@/server/db";
import { hostSummary } from "@/server/bookings";
import { handler, json, requireRole } from "@/server/http";

export const GET = handler(async () => {
  const s = await requireRole("host");
  return json({ summary: await hostSummary(db(), s.userId) });
});
