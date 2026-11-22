import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSession, SESSION_COOKIE, sessionCookieOptions, signSession, type Role, type Session } from "./auth";
import { AppError } from "./errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(e: unknown) {
  if (e instanceof AppError) return json({ error: e.code, message: e.message, details: e.details }, e.status);
  if (e instanceof ZodError) {
    return json({ error: "bad_request", message: "invalid input", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  }
  console.error(e);
  return json({ error: "internal", message: "something went wrong" }, 500);
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AppError("unauthorized", "please sign in");
  if (roles.length && !roles.includes(s.role)) throw new AppError("forbidden", `this needs the ${roles.join(" or ")} role`);
  return s;
}

/** Any signed-in account: the same person can book spots and rent out their own. */
export const requireUser = () => requireRole("user");
export const requireAdmin = () => requireRole("admin");

/** Signs the session cookie onto a response. */
export async function withSession(res: NextResponse, s: Session) {
  res.cookies.set(SESSION_COOKIE, await signSession(s), sessionCookieOptions);
  return res;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("bad_request", "body must be JSON");
  }
  return schema.parse(raw);
}

export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return fail(e);
    }
  };
}

// Best-effort, per-instance token bucket. Good enough to stop a script from
// hammering the booking endpoint in a prototype; production would use a shared
// store (Redis / Upstash) or the platform firewall.
const buckets = new Map<string, { tokens: number; at: number }>();
export function rateLimit(key: string, perMinute: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) throw new AppError("rate_limited", "too many requests, slow down");
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear();
}
