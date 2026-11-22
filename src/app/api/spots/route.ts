import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { handler, json } from "@/server/http";
import { searchSpots } from "@/server/spots";
import { searchQuery } from "@/lib/validation";

// GET /api/spots?lat=35.828&lng=10.638&radius=1500&start=ISO&end=ISO
export const GET = handler(async (req: NextRequest) => {
  const q = searchQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const spots = await searchSpots(db(), {
    lat: q.lat,
    lng: q.lng,
    radius: q.radius,
    start: new Date(q.start),
    end: new Date(q.end),
    limit: q.limit,
    sort: q.sort,
  }, { log: req.headers.get("x-plassa-nolog") !== "1" });
  return json({ count: spots.length, available: spots.filter((s) => s.available).length, spots });
});
