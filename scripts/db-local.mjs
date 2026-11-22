// Local Postgres for development and tests, no Docker needed.
// Starts an embedded PostgreSQL cluster in ./.pgdata on port 54329 and keeps it running.
// Usage: npm run db:local   (Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "plassa",
  password: "plassa",
  port: 54329,
  persistent: true,
  autoRehydrateSymlinks: true,
  // UTF-8 is required for Arabic text (Windows would otherwise pick WIN1252).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
for (const name of ["plassa", "plassa_test"]) {
  try {
    await pg.createDatabase(name);
    console.log(`created database ${name}`);
  } catch {
    /* already exists */
  }
}
console.log("Postgres ready on postgres://plassa:plassa@localhost:54329/plassa");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
