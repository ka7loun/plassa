// Runs before `next build` on Vercel (see "vercel-build" in package.json):
// applies pending migrations, and loads the demo data when the database is
// empty (or when PLASSA_RESEED=1). The connection string stays in Vercel's
// environment; nobody has to copy it anywhere.
import "dotenv/config";
import { migrate } from "./migrate";
import { seed } from "../db/seed";
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
    const { rows } = await pool.query<{ n: string }>("select count(*) as n from spots");
    if (Number(rows[0].n) === 0 || process.env.PLASSA_RESEED === "1") {
      console.log("seeded", await seed(pool));
    } else {
      console.log(`database already has ${rows[0].n} spots, keeping it`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
