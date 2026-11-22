import { db } from "@/server/db";
import { handler, json, parseBody, requireRole } from "@/server/http";
import { createSpot, listHostSpots } from "@/server/spots";
import { spotBody } from "@/lib/validation";

export const GET = handler(async () => {
  const s = await requireRole("host");
  return json({ spots: await listHostSpots(db(), s.userId) });
});

export const POST = handler(async (req: Request) => {
  const s = await requireRole("host");
  const input = await parseBody(req, spotBody);
  return json({ spot: await createSpot(db(), s.userId, input) }, 201);
});
