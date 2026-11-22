import type { Db } from "./db";
import { AppError } from "./errors";

export const MAX_PHOTO_BYTES = 1_500_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoType = (typeof TYPES)[number];

/** Checks the file really is the image type it claims to be (magic bytes). */
export function sniffImage(buf: Uint8Array): PhotoType | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

export async function savePhoto(db: Db, ownerId: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new AppError("bad_request", "empty file");
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new AppError("too_large", "photo is larger than 1.5 MB");
  const type = sniffImage(bytes);
  if (!type) throw new AppError("bad_request", "only JPEG, PNG or WebP photos");
  const { rows } = await db.query<{ id: string }>("insert into photos (owner_id, content_type, data) values ($1, $2, $3) returning id", [
    ownerId,
    type,
    Buffer.from(bytes),
  ]);
  return { id: rows[0].id, url: `/api/photos/${rows[0].id}` };
}

export async function loadPhoto(db: Db, id: string) {
  const { rows } = await db.query<{ content_type: string; data: Buffer }>("select content_type, data from photos where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "photo not found");
  return rows[0];
}
