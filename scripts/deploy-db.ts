// Runs before `next build` on Vercel (see "vercel-build" in package.json):
// applies pending migrations, and loads the demo data when the database is
// empty (or when PLASSA_RESEED=1). The connection string stays in Vercel's
// environment; nobody has to copy it anywhere.
import "dotenv/config";
import { migrate } from "./migrate";
import { seed } from "../db/seed";
import { createPool } from "../src/server/db";

// Migrations go over a direct connection when the host offers one (Neon, Supabase).
const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

async function main() {
  if (!url) throw new Error("No DATABASE_URL set. Connect a Postgres database to the Vercel project first.");
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
  console.error(e);
  process.exit(1);
});
