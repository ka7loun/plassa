import { db } from "@/server/db";
import { hostSummary } from "@/server/bookings";
import { handler, json, requireUser } from "@/server/http";

export const GET = handler(async () => {
  const s = await requireUser();
  return json({ summary: await hostSummary(db(), s.userId) });
});
