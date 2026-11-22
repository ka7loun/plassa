import { DEMO_USERS } from "../../../../../db/seed-data";
import { handler, json, parseBody, withSession } from "@/server/http";
import { demoLoginBody } from "@/lib/validation";

// One-click demo sign-in so the jury never hits a sign-up wall.
// "driver" is Yassine, "host" is Salma: both are ordinary accounts that can
// book and rent out spots; they only differ in their demo data.
export const POST = handler(async (req: Request) => {
  const { role: persona } = await parseBody(req, demoLoginBody);
  const u = DEMO_USERS[persona];
  const role = persona === "admin" ? "admin" : "user";
  return withSession(json({ user: { id: u.id, role, name: u.name } }), { userId: u.id, role, name: u.name });
});
