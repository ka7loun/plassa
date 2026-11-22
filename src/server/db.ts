import { Pool, type PoolClient, type QueryResultRow } from "pg";

export const LOCAL_DATABASE_URL = "postgres://plassa:plassa@localhost:54329/plassa";

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

function makePool(url: string) {
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    // Serverless functions: keep each instance's pool small; the hosted
    // Postgres pooler (Neon / Supabase PgBouncer) multiplexes connections.
    max: Number(process.env.DB_POOL_MAX ?? (isLocal ? 20 : 5)),
    idleTimeoutMillis: 10_000,
    ssl: isLocal || process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
}

const g = globalThis as unknown as { __plassaPool?: Pool };

/** One pool per server instance (survives dev hot reloads). */
export function db(): Pool {
  if (!g.__plassaPool) g.__plassaPool = makePool(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? LOCAL_DATABASE_URL);
  return g.__plassaPool;
}

export function createPool(url: string): Pool {
  return makePool(url);
}

export async function withTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** Postgres error code for an exclusion-constraint violation. */
export const EXCLUSION_VIOLATION = "23P01";

export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : undefined;
}
