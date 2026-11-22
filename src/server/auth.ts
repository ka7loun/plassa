import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "driver" | "host" | "admin";
export interface Session {
  userId: string;
  role: Role;
  name: string;
}

export const SESSION_COOKIE = "plassa_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.VERCEL) {
    console.warn("SESSION_SECRET is not set; using the demo fallback secret");
  }
  return new TextEncoder().encode(s ?? "plassa-demo-secret-change-me-in-production-0123456789");
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, name: s.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "driver" && role !== "host" && role !== "admin")) return null;
    return { userId: payload.sub, role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};
