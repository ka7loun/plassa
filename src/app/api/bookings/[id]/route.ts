import { z } from "zod";
import { db } from "@/server/db";
import { getDriverBooking } from "@/server/bookings";
import { handler, json, requireRole } from "@/server/http";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/bookings/[id]">) => {
  const s = await requireRole("driver");
  const id = z.string().uuid().parse((await ctx.params).id);
  return json({ booking: await getDriverBooking(db(), s.userId, id) });
});
