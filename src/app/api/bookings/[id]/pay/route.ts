import { z } from "zod";
import { db } from "@/server/db";
import { confirmPayment } from "@/server/bookings";
import { handler, json, parseBody, requireRole } from "@/server/http";
import { confirmPaymentBody } from "@/lib/validation";

// Return URL of the (simulated) wallet / card gateway.
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/bookings/[id]/pay">) => {
  const s = await requireRole("driver");
  const id = z.string().uuid().parse((await ctx.params).id);
  const { ref, approved } = await parseBody(req, confirmPaymentBody);
  return json({ booking: await confirmPayment(db(), s.userId, id, ref, approved) });
});
