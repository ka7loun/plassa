import { z } from "zod";
import { db } from "@/server/db";
import { cancelBooking } from "@/server/bookings";
import { handler, json, requireUser } from "@/server/http";

export const POST = handler(async (_req: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) => {
  const s = await requireUser();
  const id = z.string().uuid().parse((await ctx.params).id);
  return json(await cancelBooking(db(), s.userId, id));
});
