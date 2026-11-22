import { z } from "zod";
import { db } from "@/server/db";
import { createReview } from "@/server/bookings";
import { handler, json, parseBody, requireUser } from "@/server/http";
import { reviewBody } from "@/lib/validation";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/bookings/[id]/review">) => {
  const s = await requireUser();
  const id = z.string().uuid().parse((await ctx.params).id);
  const body = await parseBody(req, reviewBody);
  return json({ review: await createReview(db(), s.userId, id, body) }, 201);
});
