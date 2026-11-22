import { z } from "zod";
import { db } from "@/server/db";
import { handler, json, parseBody, requireUser } from "@/server/http";
import { patchSpot, updateSpot } from "@/server/spots";
import { spotBody, spotPatchBody } from "@/lib/validation";
import type { PaymentMethod } from "@/lib/payments";

export const PUT = handler(async (req: Request, ctx: RouteContext<"/api/host/spots/[id]">) => {
  const s = await requireUser();
  const id = z.string().uuid().parse((await ctx.params).id);
  const input = await parseBody(req, spotBody);
  return json({ spot: await updateSpot(db(), s.userId, id, input) });
});

// Pause / resume, choose which payment methods drivers see, change photos.
export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/host/spots/[id]">) => {
  const s = await requireUser();
  const id = z.string().uuid().parse((await ctx.params).id);
  const body = await parseBody(req, spotPatchBody);
  return json({ spot: await patchSpot(db(), s.userId, id, { ...body, paymentMethods: body.paymentMethods as PaymentMethod[] | undefined }) });
});
