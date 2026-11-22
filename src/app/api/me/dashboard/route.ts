import { db } from "@/server/db";
import { driverDashboard } from "@/server/dashboard";
import { handler, json, requireUser } from "@/server/http";
import { getUser } from "@/server/users";

export const GET = handler(async () => {
  const s = await requireUser();
  const [user, dashboard] = await Promise.all([getUser(db(), s.userId), driverDashboard(db(), s.userId)]);
  return json({ user, dashboard });
});
