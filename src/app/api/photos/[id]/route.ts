import { z } from "zod";
import { db } from "@/server/db";
import { handler } from "@/server/http";
import { loadPhoto } from "@/server/photos";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/photos/[id]">) => {
  const id = z.string().uuid().parse((await ctx.params).id);
  const p = await loadPhoto(db(), id);
  return new Response(new Uint8Array(p.data), {
    headers: { "content-type": p.content_type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
});
