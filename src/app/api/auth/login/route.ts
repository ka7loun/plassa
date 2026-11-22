import { db } from "@/server/db";
import { handler, json, parseBody, rateLimit, withSession } from "@/server/http";
import { login } from "@/server/users";
import { loginBody } from "@/lib/validation";

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, loginBody);
  // slow down password guessing per phone number and per client
  rateLimit(`login:${body.phone.replace(/\D/g, "").slice(-8)}`, 10);
  rateLimit(`login-ip:${req.headers.get("x-forwarded-for") ?? "local"}`, 30);
  const user = await login(db(), body);
  return withSession(json({ user }), { userId: user.id, role: user.role, name: user.name });
});
