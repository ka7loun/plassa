import { db } from "@/server/db";
import { hostSummary } from "@/server/bookings";
import { hostDashboard } from "@/server/dashboard";
import { handler, json, requireUser } from "@/server/http";

export const GET = handler(async () => {
  const s = await requireUser();
  const [summary, dashboard] = await Promise.all([hostSummary(db(), s.userId), hostDashboard(db(), s.userId)]);
  return json({ summary, dashboard });
});
