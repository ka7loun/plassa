import type { Db } from "./db";
import { AppError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import { normalizePhone } from "@/lib/phone";
import type { Role } from "./auth";

export interface UserDTO {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  password_hash: string | null;
  created_at: Date;
}

const dto = (r: UserRow): UserDTO => ({ id: r.id, role: r.role, name: r.name, phone: r.phone, createdAt: new Date(r.created_at).toISOString() });

export async function signup(db: Db, input: { name: string; phone: string; password: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("bad_request", "invalid phone number");
  const hash = await hashPassword(input.password);
  const { rows } = await db.query<UserRow>(
    `insert into users (role, name, phone, password_hash) values ('user', $1, $2, $3)
     on conflict (phone) where phone is not null do nothing
     returning *`,
    [input.name.trim(), phone, hash],
  );
  if (!rows[0]) throw new AppError("phone_taken", "an account already uses this phone number");
  return dto(rows[0]);
}

export async function login(db: Db, input: { phone: string; password: string }) {
  const phone = normalizePhone(input.phone);
  const { rows } = phone ? await db.query<UserRow>("select * from users where phone = $1", [phone]) : { rows: [] as UserRow[] };
  const ok = await verifyPassword(input.password, rows[0]?.password_hash);
  // same answer for "no such phone" and "wrong password"
  if (!rows[0] || !ok) throw new AppError("bad_credentials", "wrong phone number or password");
  return dto(rows[0]);
}

export async function getUser(db: Db, id: string) {
  const { rows } = await db.query<UserRow>("select * from users where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "user not found");
  return dto(rows[0]);
}
