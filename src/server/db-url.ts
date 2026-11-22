// Finds the Postgres connection string however the host named it.
// Vercel's Neon / Supabase integrations set DATABASE_URL or POSTGRES_URL, or
// prefixed names (STORAGE_URL, PLASSA_DATABASE_URL, ...) when a custom prefix was chosen.
type Env = Record<string, string | undefined>;

const POOLED = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"];
const DIRECT = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL_NO_SSL"];

function isPg(v: string | undefined): v is string {
  return !!v && /^postgres(ql)?:\/\//.test(v);
}

/** Connection for the app (pooled when available). */
export function databaseUrl(env: Env = process.env): string | undefined {
  for (const k of POOLED) if (isPg(env[k])) return env[k];
  // prefixed variants, e.g. STORAGE_URL or PLASSA_DATABASE_URL, skipping direct ones
  const keys = Object.keys(env).sort();
  const k =
    keys.find((k) => /(DATABASE|POSTGRES)_URL$/.test(k) && !/^(TEST|BENCH)_/.test(k) && isPg(env[k])) ??
    keys.find((k) => /_URL$/.test(k) && !/^(TEST|BENCH)_|UNPOOLED|NON_POOLING|NO_SSL/.test(k) && isPg(env[k]));
  return k ? env[k] : undefined;
}

/** Direct (unpooled) connection for migrations, falling back to the pooled one. */
export function directDatabaseUrl(env: Env = process.env): string | undefined {
  for (const k of DIRECT) if (isPg(env[k])) return env[k];
  const k = Object.keys(env).sort().find((k) => /(UNPOOLED|NON_POOLING)$/.test(k) && isPg(env[k]));
  return k ? env[k] : databaseUrl(env);
}

/** Names (never values) of variables that look database-related, for error messages. */
export function databaseEnvNames(env: Env = process.env): string[] {
  return Object.keys(env).filter((k) => /DATABASE|POSTGRES|^PG|NEON|SUPABASE|STORAGE/.test(k)).sort();
}
