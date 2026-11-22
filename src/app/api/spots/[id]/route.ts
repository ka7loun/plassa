import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { handler, json } from "@/server/http";
import { getSpot, spotSchedule } from "@/server/spots";

const q = z.object({ start: z.string().datetime({ offset: true }).optional(), end: z.string().datetime({ offset: true }).optional() });

export const GET = handler(async (req: NextRequest, ctx: RouteContext<"/api/spots/[id]">) => {
  const { id } = await ctx.params;
  z.string().uuid().parse(id);
  const { start, end } = q.parse(Object.fromEntries(req.nextUrl.searchParams));
  const window = start && end && new Date(end) > new Date(start) ? { start: new Date(start), end: new Date(end) } : undefined;
  const spot = await getSpot(db(), id, window);
  const from = window ? new Date(window.start.getTime() - 12 * 3_600_000) : new Date();
  const to = new Date(from.getTime() + 36 * 3_600_000);
  return json({ spot, booked: await spotSchedule(db(), id, from, to) });
});
