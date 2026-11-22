import { db } from "@/server/db";
import { cityStats } from "@/server/admin";
import { handler, json, requireAdmin } from "@/server/http";

export const GET = handler(async () => {
  await requireAdmin();
  return json(await cityStats(db(), "sousse"));
});
