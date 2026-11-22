import { z } from "zod";
import { db } from "@/server/db";
import { handler, json, parseBody, requireRole } from "@/server/http";
import { setSpotActive, updateSpot } from "@/server/spots";
import { spotBody } from "@/lib/validation";

export const PUT = handler(async (req: Request, ctx: RouteContext<"/api/host/spots/[id]">) => {
  const s = await requireRole("host");
  const id = z.string().uuid().parse((await ctx.params).id);
  const input = await parseBody(req, spotBody);
  return json({ spot: await updateSpot(db(), s.userId, id, input) });
});

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/host/spots/[id]">) => {
  const s = await requireRole("host");
  const id = z.string().uuid().parse((await ctx.params).id);
  const { active } = await parseBody(req, z.object({ active: z.boolean() }));
  return json({ spot: await setSpotActive(db(), s.userId, id, active) });
});
