import { DEMO_USERS } from "../../../../../db/seed-data";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth";
import { handler, json, parseBody } from "@/server/http";
import { demoLoginBody } from "@/lib/validation";

// One-click demo sign-in so the jury never hits a sign-up wall.
export const POST = handler(async (req: Request) => {
  const { role } = await parseBody(req, demoLoginBody);
  const u = DEMO_USERS[role];
  const token = await signSession({ userId: u.id, role, name: u.name });
  const res = json({ user: { id: u.id, role, name: u.name } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
