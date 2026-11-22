import { db } from "@/server/db";
import { handler, json, rateLimit, requireUser } from "@/server/http";
import { MAX_PHOTO_BYTES, savePhoto } from "@/server/photos";
import { AppError } from "@/server/errors";

// Upload one photo as the raw request body (the browser resizes it first).
export const POST = handler(async (req: Request) => {
  const s = await requireUser();
  rateLimit(`photo:${s.userId}`, 30);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) throw new AppError("too_large", "photo is larger than 1.5 MB");
  const bytes = new Uint8Array(await req.arrayBuffer());
  return json(await savePhoto(db(), s.userId, bytes), 201);
});
