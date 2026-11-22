import { db } from "@/server/db";
import { checkIn } from "@/server/bookings";
import { handler, json, parseBody, rateLimit, requireUser } from "@/server/http";
import { checkinBody } from "@/lib/validation";

export const POST = handler(async (req: Request) => {
  const s = await requireUser();
  rateLimit(`checkin:${s.userId}`, 20); // 4-digit codes: limit guessing
  const { code } = await parseBody(req, checkinBody);
  return json({ booking: await checkIn(db(), s.userId, code) });
});
