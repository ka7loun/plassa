import { getSession } from "@/server/auth";
import { json } from "@/server/http";

export async function GET() {
  const s = await getSession();
  return json({ user: s ? { id: s.userId, role: s.role, name: s.name } : null });
}
