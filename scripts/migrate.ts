// Applies db/migrations/*.sql in order, once each. Usage: npm run db:migrate
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createPool, LOCAL_DATABASE_URL } from "../src/server/db";

export async function migrate(url = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL) {
  const pool = createPool(url);
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  try {
    await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await pool.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      await pool.query(readFileSync(path.join(dir, f), "utf8"));
      await pool.query("insert into schema_migrations(name) values ($1)", [f]);
      console.log(`applied ${f}`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  migrate().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
