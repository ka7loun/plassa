import { db } from "@/server/db";
import { json } from "@/server/http";

export async function GET() {
  const t = Date.now();
  try {
    await db().query("select 1");
    return json({ ok: true, db: "up", dbMs: Date.now() - t });
  } catch {
    return json({ ok: false, db: "down" }, 503);
  }
}
