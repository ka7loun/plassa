import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { cityStats } from "@/server/admin";
import { handler, json, requireRole } from "@/server/http";

export const GET = handler(async (req: NextRequest) => {
  await requireRole("admin");
  const city = z.enum(["sousse", "monastir"]).catch("sousse").parse(req.nextUrl.searchParams.get("city") ?? "sousse");
  return json(await cityStats(db(), city));
});
