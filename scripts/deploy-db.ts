// Runs before `next build` on Vercel (see "vercel-build" in package.json):
// applies pending migrations, and loads the demo data when the database is
// empty, when the demo data version changed (SEED_VERSION), or when
// PLASSA_RESEED=1. The connection string stays in Vercel's
// environment; nobody has to copy it anywhere.
import "dotenv/config";
import { migrate } from "./migrate";
import { seed } from "../db/seed";
import { SEED_VERSION } from "../db/seed-data";
import { createPool } from "../src/server/db";
import { databaseEnvNames, directDatabaseUrl } from "../src/server/db-url";

async function main() {
  const url = directDatabaseUrl();
  if (!url) {
    const seen = databaseEnvNames();
    throw new Error(
      "No Postgres connection string found. Connect a database in the Vercel project (Storage tab), then redeploy.\n" +
        `Database-related variables visible to this build: ${seen.length ? seen.join(", ") : "none"}`,
    );
  }
  console.log(`using database host ${new URL(url).hostname}`);
  await migrate(url);
  const pool = createPool(url);
  try {
    const { rows } = await pool.query<{ n: string; v: string | null }>(
      "select (select count(*) from spots) as n, (select value from app_meta where key = 'seed_version') as v",
    );
    const { n, v } = rows[0];
    if (Number(n) === 0 || v !== SEED_VERSION || process.env.PLASSA_RESEED === "1") {
      console.log(`reseeding demo data (version ${v ?? "none"} -> ${SEED_VERSION})`);
      console.log("seeded", await seed(pool));
    } else {
      console.log(`database already has ${n} spots at seed version ${v}, keeping it`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
