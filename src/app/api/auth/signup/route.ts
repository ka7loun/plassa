import { db } from "@/server/db";
import { handler, json, parseBody, rateLimit, withSession } from "@/server/http";
import { signup } from "@/server/users";
import { signupBody } from "@/lib/validation";

export const POST = handler(async (req: Request) => {
  rateLimit(`signup:${req.headers.get("x-forwarded-for") ?? "local"}`, 10);
  const body = await parseBody(req, signupBody);
  const user = await signup(db(), body);
  return withSession(json({ user }, 201), { userId: user.id, role: user.role, name: user.name });
});
