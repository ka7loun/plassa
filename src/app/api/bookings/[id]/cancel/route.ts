import { z } from "zod";
import { db } from "@/server/db";
import { cancelBooking } from "@/server/bookings";
import { handler, json, requireRole } from "@/server/http";

export const POST = handler(async (_req: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) => {
  const s = await requireRole("driver");
  const id = z.string().uuid().parse((await ctx.params).id);
  return json(await cancelBooking(db(), s.userId, id));
});
